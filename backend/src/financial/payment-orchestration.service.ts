import { Inject, Injectable } from '@nestjs/common';
import {
  OrderStatus,
  PaymentAttemptStatus,
  PaymentStatus,
  Prisma,
  ReconciliationIssueType,
} from '@prisma/client';
import { canonicalRequestHash, sha256 } from '../commerce/idempotency-key';
import type { ParsedIdempotencyKey } from '../commerce/idempotency-key';
import { acquireAdvisoryTransactionLock } from '../database/advisory-lock';
import { PrismaService } from '../database/prisma.service';
import { FinancialDomainError } from './financial.errors';
import {
  PaymentProviderError,
  type PaymentProviderPort,
  type ProviderPayment,
} from './payment-provider.port';
import { assertFinancialTransition } from './state-machines';

export const PAYMENT_PROVIDER_PORT = Symbol('PAYMENT_PROVIDER_PORT');
const OPERATION = 'PAYMENT_CREATE';
const BLOCKING = new Set<PaymentAttemptStatus>([
  PaymentAttemptStatus.PENDING,
  PaymentAttemptStatus.PROCESSING,
  PaymentAttemptStatus.REQUIRES_ACTION,
]);

type Prepared = {
  paymentId: string;
  attemptId: string;
  orderId: string;
  orderPublicCode: string;
  amountMinor: bigint;
  currency: 'BRL';
  attemptNumber: number;
  reused: boolean;
};

export type PaymentOrchestrationResult = {
  paymentId: string;
  attemptId: string;
  attemptNumber: number;
  providerCode: string;
  method: null;
  status: PaymentAttemptStatus;
  amountMinor: string;
  currency: 'BRL';
  externalPaymentId: string | null;
};

/** Internal-only orchestration for the generic Efí sandbox Billing charge. */
@Injectable()
export class PaymentOrchestrationService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(PAYMENT_PROVIDER_PORT) private readonly provider: PaymentProviderPort,
  ) {}

  async initiateBilling(
    buyerUserId: string,
    orderId: string,
    key: ParsedIdempotencyKey,
  ): Promise<PaymentOrchestrationResult> {
    this.provider.assertAvailable();
    const providerCode = this.provider.providerCode;
    if (!/^[A-Z0-9_]{2,64}$/.test(providerCode))
      throw new FinancialDomainError('PAYMENT_PROVIDER_FAILURE');
    const scopedKeyHash = sha256(`${buyerUserId}:${OPERATION}:${key.hash}`);
    const requestHash = canonicalRequestHash({
      actorUserId: buyerUserId,
      operation: OPERATION,
      orderId,
      method: null,
    });
    const prepared = await this.prepare(buyerUserId, orderId, scopedKeyHash, requestHash);
    if (prepared.reused) {
      const reconciliation = await this.prisma.reconciliationIssue.findFirst({
        where: {
          referenceType: 'PAYMENT_ATTEMPT',
          referenceId: prepared.attemptId,
          status: { in: ['OPEN', 'INVESTIGATING'] },
        },
        select: { id: true },
      });
      if (reconciliation) throw new FinancialDomainError('PAYMENT_RECONCILIATION_REQUIRED');
      return this.result(prepared.attemptId);
    }

    let external: ProviderPayment;
    try {
      external = await this.provider.createPayment({
        reference: prepared.orderPublicCode,
        money: { amountMinor: prepared.amountMinor, currency: prepared.currency },
        idempotencyHash: scopedKeyHash,
      });
    } catch (error) {
      await this.handleProviderFailure(prepared, error);
      throw error; // handleProviderFailure always throws; retained for exhaustiveness.
    }

    if (
      !external.id ||
      external.money.currency !== prepared.currency ||
      external.money.amountMinor !== prepared.amountMinor ||
      external.status !== 'PENDING'
    ) {
      try {
        await this.persistAmbiguous(prepared, external, 'UNEXPECTED_PROVIDER_RESULT');
      } catch {
        await this.bestEffortIssue(prepared, 'UNEXPECTED_PROVIDER_RESULT_PERSISTENCE_FAILED');
      }
      throw new FinancialDomainError('PAYMENT_RECONCILIATION_REQUIRED');
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        await acquireAdvisoryTransactionLock(tx, `payment-attempt:${prepared.attemptId}`);
        const current = await tx.paymentAttempt.findUniqueOrThrow({
          where: { id: prepared.attemptId },
        });
        if (current.externalPaymentId && current.externalPaymentId !== external.id)
          throw new FinancialDomainError('PAYMENT_RECONCILIATION_REQUIRED');
        if (!BLOCKING.has(current.status))
          throw new FinancialDomainError('PAYMENT_RECONCILIATION_REQUIRED');
        await tx.paymentAttempt.update({
          where: { id: current.id },
          data: { externalPaymentId: external.id, providerStatusRaw: external.status },
        });
      });
    } catch {
      await this.bestEffortIssue(prepared, 'PROVIDER_SUCCEEDED_LOCAL_PERSISTENCE_FAILED');
      throw new FinancialDomainError('PAYMENT_RECONCILIATION_REQUIRED');
    }
    return this.result(prepared.attemptId);
  }

  private async prepare(
    buyerUserId: string,
    orderId: string,
    idempotencyKeyHash: string,
    requestHash: string,
  ): Promise<Prepared> {
    return this.prisma.$transaction(async (tx) => {
      await acquireAdvisoryTransactionLock(tx, `payment-order:${orderId}`);
      const order = await tx.order.findFirst({ where: { id: orderId, buyerUserId } });
      if (
        !order ||
        order.status !== OrderStatus.PENDING_PAYMENT ||
        order.cancelledAt !== null ||
        order.expiredAt !== null ||
        order.expiresAt <= new Date() ||
        order.currency !== 'BRL' ||
        order.totalAmountMinor <= 0n ||
        (order.paymentStatus !== PaymentStatus.NOT_CREATED &&
          order.paymentStatus !== PaymentStatus.PENDING)
      )
        throw new FinancialDomainError('ORDER_NOT_PAYMENT_ELIGIBLE');

      const payment =
        (await tx.payment.findUnique({ where: { orderId: order.id } })) ??
        (await this.createPayment(tx, order));
      if (
        payment.status !== PaymentStatus.PENDING ||
        payment.currency !== 'BRL' ||
        payment.amountMinor !== order.totalAmountMinor
      )
        throw new FinancialDomainError('ORDER_NOT_PAYMENT_ELIGIBLE');

      const keyed = await tx.paymentAttempt.findUnique({
        where: {
          providerCode_idempotencyKeyHash: {
            providerCode: this.provider.providerCode,
            idempotencyKeyHash,
          },
        },
      });
      if (keyed) {
        if (keyed.paymentId !== payment.id || keyed.requestHash !== requestHash)
          throw new FinancialDomainError('IDEMPOTENCY_KEY_REUSED');
        return this.prepared(payment.id, order, keyed, true);
      }

      const latest = await tx.paymentAttempt.findFirst({
        where: { paymentId: payment.id },
        orderBy: { attemptNumber: 'desc' },
      });
      if (latest && BLOCKING.has(latest.status))
        throw new FinancialDomainError('PAYMENT_ATTEMPT_IN_PROGRESS');

      assertFinancialTransition('paymentAttempt', 'CREATED', 'PENDING');
      const attempt = await tx.paymentAttempt.create({
        data: {
          paymentId: payment.id,
          attemptNumber: (latest?.attemptNumber ?? 0) + 1,
          providerCode: this.provider.providerCode,
          method: null,
          status: PaymentAttemptStatus.PENDING,
          amountMinor: payment.amountMinor,
          currency: 'BRL',
          idempotencyKeyHash,
          requestHash,
          expiresAt: order.expiresAt,
        },
      });
      return this.prepared(payment.id, order, attempt, false);
    });
  }

  private async createPayment(
    tx: Prisma.TransactionClient,
    order: { id: string; totalAmountMinor: bigint },
  ) {
    assertFinancialTransition('payment', 'NOT_CREATED', 'PENDING');
    const payment = await tx.payment.create({
      data: {
        orderId: order.id,
        amountMinor: order.totalAmountMinor,
        currency: 'BRL',
        status: 'PENDING',
      },
    });
    const changed = await tx.order.updateMany({
      where: { id: order.id, status: 'PENDING_PAYMENT', paymentStatus: 'NOT_CREATED' },
      data: { paymentStatus: 'PENDING', version: { increment: 1 } },
    });
    if (changed.count !== 1) throw new FinancialDomainError('ORDER_NOT_PAYMENT_ELIGIBLE');
    return payment;
  }

  private prepared(
    paymentId: string,
    order: { id: string; publicCode: string },
    attempt: { id: string; amountMinor: bigint; currency: string; attemptNumber: number },
    reused: boolean,
  ): Prepared {
    return {
      paymentId,
      attemptId: attempt.id,
      orderId: order.id,
      orderPublicCode: order.publicCode,
      amountMinor: attempt.amountMinor,
      currency: attempt.currency as 'BRL',
      attemptNumber: attempt.attemptNumber,
      reused,
    };
  }

  private async handleProviderFailure(prepared: Prepared, error: unknown): Promise<never> {
    if (!(error instanceof PaymentProviderError) || error.requiresReconciliation) {
      await this.bestEffortIssue(prepared, 'AMBIGUOUS_PROVIDER_MUTATION');
      throw new FinancialDomainError('PAYMENT_RECONCILIATION_REQUIRED');
    }
    assertFinancialTransition('paymentAttempt', 'PENDING', 'FAILED');
    await this.prisma.paymentAttempt.updateMany({
      where: { id: prepared.attemptId, status: PaymentAttemptStatus.PENDING },
      data: { status: PaymentAttemptStatus.FAILED, providerStatusRaw: error.reason },
    });
    throw new FinancialDomainError('PAYMENT_PROVIDER_FAILURE');
  }

  private async persistAmbiguous(prepared: Prepared, external: ProviderPayment, reason: string) {
    await this.prisma.$transaction(async (tx) => {
      await acquireAdvisoryTransactionLock(tx, `payment-attempt:${prepared.attemptId}`);
      await tx.paymentAttempt.updateMany({
        where: { id: prepared.attemptId, status: { in: [...BLOCKING] } },
        data: {
          externalPaymentId: external.id || undefined,
          providerStatusRaw: external.status,
        },
      });
      await this.createIssue(tx, prepared, reason, external.money.amountMinor);
    });
  }

  private async bestEffortIssue(prepared: Prepared, reason: string) {
    try {
      await this.prisma.$transaction((tx) => this.createIssue(tx, prepared, reason));
    } catch {
      // The pre-committed PENDING attempt is deliberately left blocking at-most-once replay.
    }
  }

  private async createIssue(
    tx: Prisma.TransactionClient,
    prepared: Prepared,
    reason: string,
    observedAmountMinor?: bigint,
  ) {
    const prior = await tx.reconciliationIssue.findFirst({
      where: {
        providerCode: this.provider.providerCode,
        referenceType: 'PAYMENT_ATTEMPT',
        referenceId: prepared.attemptId,
        status: { not: 'RESOLVED' },
      },
    });
    if (prior) return prior;
    return tx.reconciliationIssue.create({
      data: {
        providerCode: this.provider.providerCode,
        type:
          observedAmountMinor !== undefined && observedAmountMinor !== prepared.amountMinor
            ? ReconciliationIssueType.AMOUNT_MISMATCH
            : ReconciliationIssueType.OTHER,
        referenceType: 'PAYMENT_ATTEMPT',
        referenceId: prepared.attemptId,
        expectedAmountMinor: prepared.amountMinor,
        observedAmountMinor,
        currency: prepared.currency,
        details: { reason, paymentId: prepared.paymentId, orderId: prepared.orderId },
      },
    });
  }

  private async result(attemptId: string): Promise<PaymentOrchestrationResult> {
    const attempt = await this.prisma.paymentAttempt.findUniqueOrThrow({
      where: { id: attemptId },
    });
    return {
      paymentId: attempt.paymentId,
      attemptId: attempt.id,
      attemptNumber: attempt.attemptNumber,
      providerCode: attempt.providerCode,
      method: null,
      status: attempt.status,
      amountMinor: attempt.amountMinor.toString(),
      currency: 'BRL',
      externalPaymentId: attempt.externalPaymentId,
    };
  }
}
