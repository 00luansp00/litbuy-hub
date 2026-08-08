import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import {
  DisputeStatus,
  FulfillmentStatus,
  OrderStatus,
  PaymentStatus,
  Prisma,
  ReconciliationIssueType,
} from '@prisma/client';
import { acquireAdvisoryTransactionLock } from '../database/advisory-lock';
import { PrismaService } from '../database/prisma.service';
import { FinancialDomainError } from './financial.errors';
import { FinancialLedgerService } from './financial-ledger.service';

const LEDGER_TYPE = 'SELLER_FUNDS_HELD';
const LEDGER_REFERENCE_TYPE = 'OrderSellerHold';
const ISSUE_REFERENCE_TYPE = 'SellerPendingHold';
export type SellerPendingHoldCandidateResult = 'NO_CANDIDATE' | 'ALREADY_HANDLED' | 'PROCESSED';
type Failure = { type: ReconciliationIssueType; code: string };
type Snapshot = {
  id: string;
  sellerProfileId: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  disputeStatus: DisputeStatus;
  currency: string;
  totalAmountMinor: bigint;
  platformFeeAmountMinor: bigint;
};
type PaymentSnapshot = {
  id: string;
  status: PaymentStatus;
  paidAt: Date | null;
  amountMinor: bigint;
  currency: string;
};
type LedgerTransactionWithAccounts = Prisma.LedgerTransactionGetPayload<{
  include: { entries: { include: { account: true } } };
}>;

@Injectable()
export class SellerPendingHoldService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: FinancialLedgerService,
  ) {}

  async processOne(orderId?: string): Promise<SellerPendingHoldCandidateResult> {
    const id = orderId ?? (await this.nextCandidate());
    if (!id) return 'NO_CANDIDATE';
    return this.processOrder(id);
  }

  async processBatch(limit = 25): Promise<number> {
    const bounded = Math.max(1, Math.min(limit, 100));
    let processed = 0;
    while (processed < bounded) {
      const result = await this.processOne();
      if (result === 'NO_CANDIDATE') break;
      if (result === 'PROCESSED') processed += 1;
    }
    return processed;
  }

  private async nextCandidate(): Promise<string | null> {
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT o."id" FROM "Order" o
      WHERE o."status" = 'COMPLETED'
        AND o."paymentStatus" = 'PAID'
        AND o."fulfillmentStatus" = 'CONFIRMED'
        AND o."disputeStatus" NOT IN ('OPEN', 'UNDER_REVIEW')
        AND NOT EXISTS (
          SELECT 1 FROM "FinancialHold" h
          JOIN "Payment" hp ON hp."id" = h."paymentId" AND hp."orderId" = o."id"
          JOIN "LedgerTransaction" lt ON lt."id" = h."ledgerTransactionId"
          WHERE h."orderId" = o."id" AND h."reason" = 'DELIVERY_PROTECTION'
            AND h."sellerProfileId" = o."sellerProfileId"
            AND h."amountMinor" = o."totalAmountMinor" - o."platformFeeAmountMinor"
            AND h."currency" = 'BRL' AND h."status" = 'ACTIVE'
            AND lt."type" = ${LEDGER_TYPE} AND lt."referenceType" = ${LEDGER_REFERENCE_TYPE}
            AND lt."referenceId" = o."id"
        )
        AND NOT EXISTS (SELECT 1 FROM "SellerPendingHoldZero" z
          JOIN "Payment" zp ON zp."id" = z."paymentId" AND zp."orderId" = o."id"
          WHERE z."orderId" = o."id" AND z."sellerProfileId" = o."sellerProfileId"
            AND o."totalAmountMinor" = o."platformFeeAmountMinor")
        AND NOT EXISTS (
          SELECT 1 FROM "ReconciliationIssue" r
          WHERE r."referenceType" = ${ISSUE_REFERENCE_TYPE}
            AND r."referenceId" = o."id"::text
            AND r."status" IN ('OPEN', 'INVESTIGATING')
        )
      ORDER BY o."updatedAt", o."id" LIMIT 1
    `;
    return rows[0]?.id ?? null;
  }

  private async processOrder(orderId: string): Promise<SellerPendingHoldCandidateResult> {
    const validation = await this.validateLocked(orderId);
    if ('blocked' in validation) return 'ALREADY_HANDLED';
    if ('failure' in validation) {
      await this.ensureIssue(orderId, validation.failure);
      return 'PROCESSED';
    }
    const { order, payment, proceeds } = validation;
    if (proceeds === 0n) {
      const created = await this.markZero(order, payment);
      return created ? 'PROCESSED' : 'ALREADY_HANDLED';
    }

    const expectedKey = this.holdKey(order.id);
    const existing = await this.prisma.ledgerTransaction.findMany({
      where: { type: LEDGER_TYPE, referenceType: LEDGER_REFERENCE_TYPE, referenceId: order.id },
      include: { entries: { include: { account: true } } },
    });
    if (existing.length && !this.validHoldPosting(existing, order, proceeds, expectedKey)) {
      await this.ensureIssue(order.id, {
        type: 'OTHER',
        code: 'SELLER_HOLD_LEDGER_IDEMPOTENCY_MISMATCH',
      });
      return 'PROCESSED';
    }

    try {
      const outcome = await this.postAndCreateHoldAtomically(order, payment, proceeds, expectedKey);
      return outcome;
    } catch (error) {
      if (error instanceof FinancialDomainError) {
        if (error.code === 'FINANCIAL_CONCURRENCY_CONFLICT') throw error;
        await this.ensureIssue(order.id, {
          type: error.code === 'INSUFFICIENT_FINANCIAL_BALANCE' ? 'AMOUNT_MISMATCH' : 'OTHER',
          code:
            error.code === 'IDEMPOTENCY_KEY_REUSED'
              ? 'SELLER_HOLD_LEDGER_IDEMPOTENCY_MISMATCH'
              : 'SELLER_HOLD_POSTING_FAILED',
        });
        return 'PROCESSED';
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        await this.ensureIssue(order.id, { type: 'OTHER', code: 'SELLER_HOLD_ARTIFACT_MISMATCH' });
        return 'PROCESSED';
      }
      throw error;
    }
  }

  private async postAndCreateHoldAtomically(
    order: Snapshot,
    payment: PaymentSnapshot,
    proceeds: bigint,
    expectedKey: string,
  ): Promise<SellerPendingHoldCandidateResult> {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            const holds = await tx.financialHold.findMany({
              where: { orderId: order.id, reason: 'DELIVERY_PROTECTION' },
            });
            const postings = await tx.ledgerTransaction.findMany({
              where: {
                type: LEDGER_TYPE,
                referenceType: LEDGER_REFERENCE_TYPE,
                referenceId: order.id,
              },
              include: { entries: { include: { account: true } } },
            });
            if (holds.length && !postings.length)
              throw new FinancialDomainError('IDEMPOTENCY_KEY_REUSED');
            const accounts = await tx.ledgerAccount.findMany({
              where: {
                ownerType: 'SELLER',
                ownerId: order.sellerProfileId,
                currency: 'BRL',
                purpose: { in: ['SELLER_PENDING', 'SELLER_HELD'] },
              },
            });
            const pending = accounts.find((account) => account.purpose === 'SELLER_PENDING');
            const held = accounts.find((account) => account.purpose === 'SELLER_HELD');
            if (!pending || !held) throw new FinancialDomainError('INVALID_MONEY');
            const outcome = await this.ledger.postWithOutcomeInTransaction(tx, {
              type: LEDGER_TYPE,
              currency: 'BRL',
              idempotencyKeyHash: expectedKey,
              referenceType: LEDGER_REFERENCE_TYPE,
              referenceId: order.id,
              emitOutbox: true,
              metadata: {
                orderId: order.id,
                paymentId: payment.id,
                sellerProfileId: order.sellerProfileId,
                amountMinor: proceeds.toString(),
                currency: 'BRL',
                referenceType: LEDGER_REFERENCE_TYPE,
              },
              entries: [
                { accountId: pending.id, direction: 'DEBIT', amountMinor: proceeds },
                { accountId: held.id, direction: 'CREDIT', amountMinor: proceeds },
              ],
            });
            const prior = holds[0];
            if (!prior)
              await tx.financialHold.create({
                data: {
                  orderId: order.id,
                  paymentId: payment.id,
                  sellerProfileId: order.sellerProfileId,
                  ledgerTransactionId: outcome.transaction.id,
                  amountMinor: proceeds,
                  currency: 'BRL',
                  reason: 'DELIVERY_PROTECTION',
                  status: 'ACTIVE',
                  releaseEligibleAt: null,
                },
              });
            else if (prior.ledgerTransactionId !== outcome.transaction.id)
              throw new FinancialDomainError('IDEMPOTENCY_KEY_REUSED');
            return outcome.created ? 'PROCESSED' : 'ALREADY_HANDLED';
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034'))
          throw error;
        if (attempt === 3) throw new FinancialDomainError('FINANCIAL_CONCURRENCY_CONFLICT');
      }
    }
    throw new FinancialDomainError('FINANCIAL_CONCURRENCY_CONFLICT');
  }

  private async validateLocked(
    orderId: string,
  ): Promise<
    | { order: Snapshot; payment: PaymentSnapshot; proceeds: bigint }
    | { failure: Failure }
    | { blocked: true }
  > {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Snapshot[]>`
        SELECT "id", "sellerProfileId", "status", "paymentStatus", "fulfillmentStatus",
               "disputeStatus", "currency", "totalAmountMinor", "platformFeeAmountMinor"
        FROM "Order" WHERE "id" = ${orderId}::uuid FOR UPDATE
      `;
      const order = rows[0];
      if (!order) return { failure: { type: 'MISSING_LOCAL', code: 'ORDER_MISSING' } };
      if (order.status !== OrderStatus.COMPLETED)
        return { failure: { type: 'STATUS_MISMATCH', code: 'ORDER_NOT_COMPLETED' } };
      if (order.paymentStatus !== PaymentStatus.PAID)
        return { failure: { type: 'STATUS_MISMATCH', code: 'ORDER_PAYMENT_STATUS_MISMATCH' } };
      if (order.fulfillmentStatus !== FulfillmentStatus.CONFIRMED)
        return {
          failure: { type: 'STATUS_MISMATCH', code: 'ORDER_FULFILLMENT_STATUS_MISMATCH' },
        };
      if (
        order.disputeStatus === DisputeStatus.OPEN ||
        order.disputeStatus === DisputeStatus.UNDER_REVIEW
      )
        return { blocked: true };
      if (order.currency !== 'BRL')
        return { failure: { type: 'OTHER', code: 'PAYMENT_CURRENCY_MISMATCH' } };
      const proceeds = order.totalAmountMinor - order.platformFeeAmountMinor;
      if (proceeds < 0n)
        return { failure: { type: 'AMOUNT_MISMATCH', code: 'SELLER_PROCEEDS_INVALID' } };

      const payments = await tx.$queryRaw<PaymentSnapshot[]>`
        SELECT "id", "status", "paidAt", "amountMinor", "currency"
        FROM "Payment" WHERE "orderId" = ${order.id}::uuid FOR UPDATE
      `;
      if (payments.length !== 1)
        return { failure: { type: 'MISSING_LOCAL', code: 'PAYMENT_MISSING' } };
      const payment = payments[0];
      if (payment.status !== PaymentStatus.PAID)
        return { failure: { type: 'STATUS_MISMATCH', code: 'PAYMENT_NOT_PAID' } };
      if (!payment.paidAt)
        return { failure: { type: 'STATUS_MISMATCH', code: 'PAYMENT_PAID_AT_MISSING' } };
      if (payment.currency !== 'BRL')
        return { failure: { type: 'OTHER', code: 'PAYMENT_CURRENCY_MISMATCH' } };
      if (payment.amountMinor !== order.totalAmountMinor)
        return { failure: { type: 'AMOUNT_MISMATCH', code: 'PAYMENT_AMOUNT_MISMATCH' } };
      const recognition = await tx.ledgerTransaction.findMany({
        where: { type: 'SALE_RECOGNIZED', referenceType: 'OrderSale', referenceId: order.id },
        include: { entries: { include: { account: true } } },
      });
      if (!recognition.length)
        return { failure: { type: 'MISSING_LOCAL', code: 'SALE_RECOGNITION_MISSING' } };
      if (!this.validRecognition(recognition, order, proceeds))
        return { failure: { type: 'OTHER', code: 'SALE_RECOGNITION_INVALID' } };
      return { order, payment, proceeds };
    });
  }

  private validRecognition(
    transactions: LedgerTransactionWithAccounts[],
    order: Snapshot,
    proceeds: bigint,
  ): boolean {
    if (transactions.length !== 1) return false;
    const tx = transactions[0];
    if (
      tx.idempotencyKeyHash !== this.recognitionKey(order.id) ||
      tx.currency !== 'BRL' ||
      tx.referenceType !== 'OrderSale' ||
      tx.referenceId !== order.id
    )
      return false;
    const expected = [
      ['PROVIDER_CLEARING', 'SYSTEM', 'DEBIT', order.totalAmountMinor],
      ...(proceeds > 0n ? [['SELLER_PENDING', 'SELLER', 'CREDIT', proceeds]] : []),
      ...(order.platformFeeAmountMinor > 0n
        ? [['PLATFORM_COMMISSION', 'PLATFORM', 'CREDIT', order.platformFeeAmountMinor]]
        : []),
    ];
    return (
      tx.entries.length === expected.length &&
      expected.every(([purpose, ownerType, direction, amount]) =>
        tx.entries.some(
          (entry) =>
            entry.account.purpose === purpose &&
            entry.account.ownerType === ownerType &&
            (ownerType !== 'SELLER' || entry.account.ownerId === order.sellerProfileId) &&
            entry.direction === direction &&
            entry.amountMinor === amount,
        ),
      )
    );
  }

  private validHoldPosting(
    transactions: LedgerTransactionWithAccounts[],
    order: Snapshot,
    proceeds: bigint,
    key: string,
  ): boolean {
    if (transactions.length !== 1) return false;
    const tx = transactions[0];
    if (tx.idempotencyKeyHash !== key || tx.currency !== 'BRL' || tx.entries.length !== 2)
      return false;
    return ['SELLER_PENDING', 'SELLER_HELD'].every((purpose, index) =>
      tx.entries.some(
        (entry) =>
          entry.account.ownerType === 'SELLER' &&
          entry.account.ownerId === order.sellerProfileId &&
          entry.account.purpose === purpose &&
          entry.direction === (index === 0 ? 'DEBIT' : 'CREDIT') &&
          entry.amountMinor === proceeds,
      ),
    );
  }

  private async markZero(order: Snapshot, payment: PaymentSnapshot): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      await acquireAdvisoryTransactionLock(tx, `financial:seller-pending-hold:${order.id}`);
      const prior = await tx.sellerPendingHoldZero.findUnique({ where: { orderId: order.id } });
      if (prior) return false;
      await tx.sellerPendingHoldZero.create({
        data: { orderId: order.id, paymentId: payment.id, sellerProfileId: order.sellerProfileId },
      });
      return true;
    });
  }

  private async ensureIssue(orderId: string, failure: Failure) {
    await this.prisma.$transaction(async (tx) => {
      await acquireAdvisoryTransactionLock(tx, `financial:seller-pending-hold-issue:${orderId}`);
      await this.ensureIssueInTransaction(tx, orderId, failure);
    });
  }

  private async ensureIssueInTransaction(
    tx: Prisma.TransactionClient,
    orderId: string,
    failure: Failure,
  ) {
    const existing = await tx.reconciliationIssue.findFirst({
      where: {
        referenceType: ISSUE_REFERENCE_TYPE,
        referenceId: orderId,
        status: { in: ['OPEN', 'INVESTIGATING'] },
      },
    });
    if (!existing)
      await tx.reconciliationIssue.create({
        data: {
          type: failure.type,
          referenceType: ISSUE_REFERENCE_TYPE,
          referenceId: orderId,
          details: { errorCode: failure.code },
        },
      });
  }

  private holdKey(orderId: string) {
    return createHash('sha256').update(`seller-pending-hold:v1:${orderId}`).digest('hex');
  }
  private recognitionKey(orderId: string) {
    return createHash('sha256').update(`sale-recognition:v1:${orderId}`).digest('hex');
  }
}
