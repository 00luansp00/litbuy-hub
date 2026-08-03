import { Inject, Injectable } from '@nestjs/common';
import {
  InventoryReservationStatus,
  OrderStatus,
  PaymentAttemptStatus,
  PaymentStatus,
  Prisma,
  ProviderPaymentStatus,
  type ReconciliationIssueType,
} from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import {
  PaymentProviderError,
  type PaymentProviderPort,
  type ProviderPayment,
} from './payment-provider.port';
import { assertFinancialTransition } from './state-machines';

export const PAYMENT_EVENT_PROVIDERS = Symbol('PAYMENT_EVENT_PROVIDERS');
const MAX_TRANSIENT_ATTEMPTS = 3;
const LEASE_MINUTES = 5;

type Claim = {
  id: string;
  providerCode: string;
  externalPaymentId: string;
  normalizedPaymentStatus: ProviderPaymentStatus;
  occurredAt: Date | null;
  attempts: number;
};

type Correlation = {
  attemptId: string;
  paymentId: string;
};

@Injectable()
export class ProviderWebhookEventProcessor {
  private readonly providers: Map<string, PaymentProviderPort>;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PAYMENT_EVENT_PROVIDERS) providers: PaymentProviderPort[],
  ) {
    this.providers = new Map(providers.map((provider) => [provider.providerCode, provider]));
  }

  async processOne(): Promise<boolean> {
    const claim = await this.claimOne();
    if (!claim) return false;

    if (claim.normalizedPaymentStatus === ProviderPaymentStatus.PENDING) {
      await this.finish(claim, 'PROCESSED', null);
      return true;
    }

    const correlation = await this.correlate(claim);
    if (!correlation) {
      if (claim.attempts < MAX_TRANSIENT_ATTEMPTS) await this.retry(claim, 'MISSING_LOCAL');
      else await this.reconcile(claim, 'MISSING_LOCAL', 'MISSING_LOCAL', undefined);
      return true;
    }

    const provider = this.providers.get(claim.providerCode);
    if (!provider) {
      await this.reconcile(claim, 'OTHER', 'PROVIDER_NOT_CONFIGURED', correlation);
      return true;
    }

    let observed: ProviderPayment | null;
    try {
      provider.assertAvailable();
      observed = await provider.getPayment(claim.externalPaymentId);
    } catch (error) {
      await this.handleProviderError(claim, correlation, error);
      return true;
    }

    await this.apply(claim, correlation, observed);
    return true;
  }

  async processBatch(limit = 25): Promise<number> {
    let processed = 0;
    const bounded = Math.max(1, Math.min(limit, 100));
    while (processed < bounded && (await this.processOne())) processed += 1;
    return processed;
  }

  private async claimOne(): Promise<Claim | null> {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Claim[]>`
        WITH candidate AS (
          SELECT "id"
          FROM "ProviderWebhookEvent"
          WHERE (
            ("status" IN ('RECEIVED', 'FAILED') AND "availableAt" <= NOW())
            OR ("status" = 'PROCESSING'
              AND "processingStartedAt" < NOW() - (${LEASE_MINUTES} * INTERVAL '1 minute'))
          )
          ORDER BY "availableAt", "receivedAt", "id"
          FOR UPDATE SKIP LOCKED
          LIMIT 1
        )
        UPDATE "ProviderWebhookEvent" event
        SET "status" = 'PROCESSING',
            "attempts" = event."attempts" + 1,
            "processingStartedAt" = NOW(),
            "lastErrorCode" = NULL,
            "updatedAt" = NOW()
        FROM candidate
        WHERE event."id" = candidate."id"
        RETURNING event."id", event."providerCode", event."externalPaymentId",
          event."normalizedPaymentStatus", event."occurredAt", event."attempts"
      `;
      return rows[0] ?? null;
    });
  }

  private async correlate(claim: Claim): Promise<Correlation | null> {
    const attempt = await this.prisma.paymentAttempt.findUnique({
      where: {
        providerCode_externalPaymentId: {
          providerCode: claim.providerCode,
          externalPaymentId: claim.externalPaymentId,
        },
      },
      select: { id: true, paymentId: true },
    });
    return attempt ? { attemptId: attempt.id, paymentId: attempt.paymentId } : null;
  }

  private async apply(
    claim: Claim,
    correlation: Correlation,
    observed: ProviderPayment | null,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      if (!(await lockClaim(tx, claim))) return;
      const attempt = await lockAttempt(tx, correlation.attemptId);
      if (
        !attempt ||
        attempt.providerCode !== claim.providerCode ||
        attempt.externalPaymentId !== claim.externalPaymentId
      ) {
        await this.issueAndIgnore(tx, claim, 'MISSING_LOCAL', 'LOCAL_CORRELATION_CHANGED');
        return;
      }
      const payment = await lockPayment(tx, attempt.paymentId);
      if (!payment) {
        await this.issueAndIgnore(tx, claim, 'MISSING_LOCAL', 'PAYMENT_MISSING');
        return;
      }
      const order = await lockOrder(tx, payment.orderId);
      if (!order) {
        await this.issueAndIgnore(tx, claim, 'MISSING_LOCAL', 'ORDER_MISSING');
        return;
      }

      if (!observed) {
        await this.issueAndIgnore(tx, claim, 'MISSING_PROVIDER', 'PAYMENT_NOT_FOUND_AT_PROVIDER');
        return;
      }
      if (observed.id !== claim.externalPaymentId) {
        await this.issueAndIgnore(tx, claim, 'STATUS_MISMATCH', 'PROVIDER_IDENTITY_MISMATCH');
        return;
      }
      if (
        observed.money.currency !== 'BRL' ||
        attempt.currency !== 'BRL' ||
        payment.currency !== 'BRL' ||
        order.currency !== 'BRL'
      ) {
        await this.issueAndIgnore(tx, claim, 'OTHER', 'CURRENCY_MISMATCH', {
          observedCurrency: observed.money.currency,
        });
        return;
      }
      if (
        observed.money.amountMinor !== attempt.amountMinor ||
        observed.money.amountMinor !== payment.amountMinor ||
        observed.money.amountMinor !== order.totalAmountMinor
      ) {
        await this.issueAndIgnore(
          tx,
          claim,
          'AMOUNT_MISMATCH',
          'AMOUNT_MISMATCH',
          {},
          attempt.amountMinor,
          observed.money.amountMinor,
        );
        return;
      }

      if (claim.normalizedPaymentStatus === ProviderPaymentStatus.SUCCEEDED) {
        await this.applySucceeded(tx, claim, attempt, payment, order, observed);
        return;
      }
      if (observed.status === 'SUCCEEDED') {
        await finishLocked(tx, claim, 'IGNORED', 'STALE_PROVIDER_EVENT');
        return;
      }
      if (claim.normalizedPaymentStatus !== observed.status) {
        await this.issueAndIgnore(tx, claim, 'STATUS_MISMATCH', 'STATUS_MISMATCH', {
          eventStatus: claim.normalizedPaymentStatus,
          providerStatus: observed.status,
        });
        return;
      }
      const target = claim.normalizedPaymentStatus as 'FAILED' | 'EXPIRED';
      if (attempt.status === target) {
        await finishLocked(tx, claim, 'PROCESSED', null);
        return;
      }
      if (!['PENDING', 'PROCESSING', 'REQUIRES_ACTION'].includes(attempt.status)) {
        await this.issueAndIgnore(tx, claim, 'STATUS_MISMATCH', 'ATTEMPT_STATUS_MISMATCH');
        return;
      }
      assertFinancialTransition('paymentAttempt', attempt.status, target);
      await tx.paymentAttempt.update({
        where: { id: attempt.id },
        data: { status: target, providerStatusRaw: observed.status },
      });
      await finishLocked(tx, claim, 'PROCESSED', null);
    });
  }

  private async applySucceeded(
    tx: Prisma.TransactionClient,
    claim: Claim,
    attempt: LockedAttempt,
    payment: LockedPayment,
    order: LockedOrder,
    observed: ProviderPayment,
  ): Promise<void> {
    if (observed.status === 'PENDING') {
      if (claim.attempts < MAX_TRANSIENT_ATTEMPTS) await retryLocked(tx, claim, 'PROVIDER_PENDING');
      else await this.issueAndIgnore(tx, claim, 'STATUS_MISMATCH', 'PROVIDER_PENDING_LIMIT');
      return;
    }
    if (observed.status !== 'SUCCEEDED') {
      await this.issueAndIgnore(tx, claim, 'STATUS_MISMATCH', 'STATUS_MISMATCH', {
        eventStatus: claim.normalizedPaymentStatus,
        providerStatus: observed.status,
      });
      return;
    }
    if (!claim.occurredAt) {
      await this.issueAndIgnore(tx, claim, 'STATUS_MISMATCH', 'MISSING_OCCURRED_AT');
      return;
    }
    const otherSuccess = await tx.paymentAttempt.findFirst({
      where: { paymentId: payment.id, status: 'SUCCEEDED', id: { not: attempt.id } },
      select: { id: true, externalPaymentId: true },
    });
    if (otherSuccess) {
      await this.issueAndIgnore(tx, claim, 'STATUS_MISMATCH', 'MULTIPLE_SUCCEEDED_ATTEMPTS', {
        otherAttemptId: otherSuccess.id,
        otherExternalPaymentId: otherSuccess.externalPaymentId,
      });
      return;
    }
    if (payment.paidAt && payment.paidAt.getTime() !== claim.occurredAt.getTime()) {
      await this.issueAndIgnore(tx, claim, 'STATUS_MISMATCH', 'PAID_AT_MISMATCH');
      return;
    }
    if (payment.status === 'PAID' && !payment.paidAt) {
      await this.issueAndIgnore(tx, claim, 'STATUS_MISMATCH', 'PAID_AT_MISSING');
      return;
    }
    if (attempt.status !== 'SUCCEEDED') {
      if (!['PENDING', 'PROCESSING', 'REQUIRES_ACTION'].includes(attempt.status)) {
        await this.issueAndIgnore(tx, claim, 'STATUS_MISMATCH', 'ATTEMPT_STATUS_MISMATCH');
        return;
      }
      assertFinancialTransition('paymentAttempt', attempt.status, 'SUCCEEDED');
    }
    if (payment.status !== 'PAID') {
      if (!['PENDING', 'PROCESSING'].includes(payment.status)) {
        await this.issueAndIgnore(tx, claim, 'STATUS_MISMATCH', 'PAYMENT_STATUS_MISMATCH');
        return;
      }
      assertFinancialTransition('payment', payment.status, 'PAID');
    }

    if (attempt.status !== 'SUCCEEDED')
      await tx.paymentAttempt.update({
        where: { id: attempt.id },
        data: { status: 'SUCCEEDED', providerStatusRaw: observed.status },
      });
    if (payment.status !== 'PAID')
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: 'PAID', paidAt: claim.occurredAt, version: { increment: 1 } },
      });

    const releasedReservation = await tx.inventoryReservation.findFirst({
      where: {
        orderId: order.id,
        status: { in: [InventoryReservationStatus.RELEASED, InventoryReservationStatus.EXPIRED] },
      },
      select: { id: true, status: true },
    });
    if (
      order.status === OrderStatus.EXPIRED ||
      order.status === OrderStatus.CANCELLED ||
      claim.occurredAt > order.expiresAt ||
      releasedReservation
    ) {
      await createIssue(tx, claim, 'LATE_PAYMENT', 'LATE_PAYMENT', {
        orderStatus: order.status,
        paidAfterExpiry: claim.occurredAt > order.expiresAt,
        reservationStatus: releasedReservation?.status ?? null,
      });
    }
    await finishLocked(tx, claim, 'PROCESSED', null);
  }

  private async handleProviderError(claim: Claim, correlation: Correlation, error: unknown) {
    if (error instanceof PaymentProviderError && error.kind === 'SAFE_TO_RETRY') {
      if (claim.attempts < MAX_TRANSIENT_ATTEMPTS) await this.retry(claim, sanitize(error.reason));
      else await this.reconcile(claim, 'OTHER', 'PROVIDER_RETRY_LIMIT', correlation);
      return;
    }
    if (error instanceof PaymentProviderError && error.requiresReconciliation) {
      await this.reconcile(claim, 'OTHER', sanitize(error.reason), correlation);
      return;
    }
    await this.reconcile(
      claim,
      'OTHER',
      error instanceof PaymentProviderError ? sanitize(error.reason) : 'PROVIDER_READ_FAILED',
      correlation,
    );
  }

  private async retry(claim: Claim, code: string) {
    await this.prisma.$transaction(async (tx) => {
      if (await lockClaim(tx, claim)) await retryLocked(tx, claim, code);
    });
  }

  private async finish(claim: Claim, status: 'PROCESSED' | 'IGNORED', code: string | null) {
    await this.prisma.$transaction(async (tx) => {
      if (await lockClaim(tx, claim)) await finishLocked(tx, claim, status, code);
    });
  }

  private async reconcile(
    claim: Claim,
    type: ReconciliationIssueType,
    code: string,
    correlation?: Correlation,
  ) {
    await this.prisma.$transaction(async (tx) => {
      if (!(await lockClaim(tx, claim))) return;
      await createIssue(
        tx,
        claim,
        type,
        code,
        correlation
          ? {
              paymentAttemptId: correlation.attemptId,
              paymentId: correlation.paymentId,
            }
          : {},
      );
      await finishLocked(tx, claim, 'IGNORED', code);
    });
  }

  private async issueAndIgnore(
    tx: Prisma.TransactionClient,
    claim: Claim,
    type: ReconciliationIssueType,
    code: string,
    details: Prisma.InputJsonObject = {},
    expectedAmountMinor?: bigint,
    observedAmountMinor?: bigint,
  ) {
    await createIssue(tx, claim, type, code, details, expectedAmountMinor, observedAmountMinor);
    await finishLocked(tx, claim, 'IGNORED', code);
  }
}

type LockedAttempt = {
  id: string;
  paymentId: string;
  providerCode: string;
  externalPaymentId: string | null;
  status: PaymentAttemptStatus;
  amountMinor: bigint;
  currency: string;
};
type LockedPayment = {
  id: string;
  orderId: string;
  status: PaymentStatus;
  amountMinor: bigint;
  currency: string;
  paidAt: Date | null;
};
type LockedOrder = {
  id: string;
  status: OrderStatus;
  totalAmountMinor: bigint;
  currency: string;
  expiresAt: Date;
};

async function lockClaim(tx: Prisma.TransactionClient, claim: Pick<Claim, 'id' | 'attempts'>) {
  const rows = await tx.$queryRaw<Array<{ current: boolean }>>`
    SELECT ("status" = 'PROCESSING' AND "attempts" = ${claim.attempts}) AS current
    FROM "ProviderWebhookEvent" WHERE "id" = ${claim.id}::uuid FOR UPDATE
  `;
  return rows[0]?.current === true;
}
async function lockAttempt(tx: Prisma.TransactionClient, id: string) {
  const rows = await tx.$queryRaw<LockedAttempt[]>`
    SELECT "id", "paymentId", "providerCode", "externalPaymentId", "status",
      "amountMinor", "currency" FROM "PaymentAttempt" WHERE "id" = ${id}::uuid FOR UPDATE
  `;
  return rows[0] ?? null;
}
async function lockPayment(tx: Prisma.TransactionClient, id: string) {
  const rows = await tx.$queryRaw<LockedPayment[]>`
    SELECT "id", "orderId", "status", "amountMinor", "currency", "paidAt"
    FROM "Payment" WHERE "id" = ${id}::uuid FOR UPDATE
  `;
  return rows[0] ?? null;
}
async function lockOrder(tx: Prisma.TransactionClient, id: string) {
  const rows = await tx.$queryRaw<LockedOrder[]>`
    SELECT "id", "status", "totalAmountMinor", "currency", "expiresAt"
    FROM "Order" WHERE "id" = ${id}::uuid FOR UPDATE
  `;
  return rows[0] ?? null;
}

async function retryLocked(tx: Prisma.TransactionClient, claim: Claim, code: string) {
  assertFinancialTransition('webhook', 'PROCESSING', 'FAILED');
  const delaySeconds = Math.min(300, 2 ** Math.min(claim.attempts, 8));
  await tx.providerWebhookEvent.update({
    where: { id: claim.id },
    data: {
      status: 'FAILED',
      availableAt: new Date(Date.now() + delaySeconds * 1_000),
      processingStartedAt: null,
      lastErrorCode: code,
    },
  });
}
async function finishLocked(
  tx: Prisma.TransactionClient,
  claim: Claim,
  status: 'PROCESSED' | 'IGNORED',
  code: string | null,
) {
  assertFinancialTransition('webhook', 'PROCESSING', status);
  await tx.providerWebhookEvent.update({
    where: { id: claim.id },
    data: {
      status,
      processedAt: new Date(),
      processingStartedAt: null,
      lastErrorCode: code,
    },
  });
}
async function createIssue(
  tx: Prisma.TransactionClient,
  claim: Claim,
  type: ReconciliationIssueType,
  code: string,
  details: Prisma.InputJsonObject = {},
  expectedAmountMinor?: bigint,
  observedAmountMinor?: bigint,
) {
  const exists = await tx.reconciliationIssue.findFirst({
    where: {
      providerCode: claim.providerCode,
      type,
      referenceType: 'ProviderWebhookEvent',
      referenceId: claim.id,
      status: { in: ['OPEN', 'INVESTIGATING'] },
    },
    select: { id: true },
  });
  if (!exists)
    await tx.reconciliationIssue.create({
      data: {
        providerCode: claim.providerCode,
        type,
        referenceType: 'ProviderWebhookEvent',
        referenceId: claim.id,
        expectedAmountMinor,
        observedAmountMinor,
        details: { ...details, errorCode: code, externalPaymentId: claim.externalPaymentId },
      },
    });
}
function sanitize(code: string) {
  return /^[A-Z0-9_]{1,64}$/.test(code) ? code : 'PROVIDER_READ_FAILED';
}
