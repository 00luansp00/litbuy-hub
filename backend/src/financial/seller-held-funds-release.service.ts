import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Prisma, ReconciliationIssueType } from '@prisma/client';
import { acquireAdvisoryTransactionLock } from '../database/advisory-lock';
import { PrismaService } from '../database/prisma.service';
import { FinancialDomainError } from './financial.errors';
import { FinancialLedgerService } from './financial-ledger.service';

const LEDGER_TYPE = 'SELLER_FUNDS_RELEASED';
const LEDGER_REFERENCE_TYPE = 'FinancialHoldRelease';
const ISSUE_REFERENCE_TYPE = 'SellerHeldFundsRelease';
const RULE_CODE = 'DELIVERY_PROTECTION_DEFAULT';

export type SellerHeldFundsReleaseResult =
  'NO_CANDIDATE' | 'BUSINESS_BLOCKED' | 'RELEASED' | 'ALREADY_RELEASED' | 'RECONCILIATION_REQUIRED';
type Failure = { type: ReconciliationIssueType; code: string };
type HoldRow = {
  id: string;
  sellerProfileId: string;
  paymentId: string | null;
  orderId: string | null;
  ledgerTransactionId: string | null;
  releaseLedgerTransactionId: string | null;
  amountMinor: bigint;
  currency: string;
  reason: string;
  status: string;
  releasedAt: Date | null;
  sellerReleasePolicyVersionId: string | null;
  sellerReleasePolicyRuleId: string | null;
  releaseDelayHours: number | null;
  releasePolicyAppliedAt: Date | null;
  releaseEligibleAt: Date | null;
  snapshotValid: boolean;
  due: boolean;
};
type Posting = Prisma.LedgerTransactionGetPayload<{
  include: { entries: { include: { account: true } } };
}>;

@Injectable()
export class SellerHeldFundsReleaseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: FinancialLedgerService,
  ) {}

  async processOne(holdId?: string): Promise<SellerHeldFundsReleaseResult> {
    const id = holdId ?? (await this.nextCandidate());
    if (!id) return 'NO_CANDIDATE';
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        return await this.prisma.$transaction((tx) => this.processInTransaction(tx, id), {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (error) {
        if (this.isInsufficientBalance(error)) {
          await this.ensureIssue(id, {
            type: 'AMOUNT_MISMATCH',
            code: 'SELLER_HELD_BALANCE_INSUFFICIENT',
          });
          return 'RECONCILIATION_REQUIRED';
        }
        if (!this.isSerializationFailure(error) || attempt === 3) throw error;
      }
    }
    throw new Error('unreachable');
  }

  async processBatch(limit = 25): Promise<number> {
    const ids = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT h."id" FROM "FinancialHold" h
      WHERE h."reason" = 'DELIVERY_PROTECTION' AND h."status" = 'RELEASE_ELIGIBLE'
        AND NOT EXISTS (
          SELECT 1 FROM "ReconciliationIssue" r
          WHERE r."referenceType" = ${ISSUE_REFERENCE_TYPE}
            AND r."referenceId" = h."id"::text
            AND r."status" IN ('OPEN', 'INVESTIGATING')
        )
      ORDER BY h."releaseEligibleAt", h."id"
      LIMIT ${Math.max(1, Math.min(limit, 100))}
    `;
    const results = await Promise.all(ids.map(({ id }) => this.processOne(id)));
    return results.filter((result) => result === 'RELEASED').length;
  }

  private async nextCandidate() {
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT h."id" FROM "FinancialHold" h
      WHERE h."reason" = 'DELIVERY_PROTECTION' AND h."status" = 'RELEASE_ELIGIBLE'
        AND NOT EXISTS (
          SELECT 1 FROM "ReconciliationIssue" r
          WHERE r."referenceType" = ${ISSUE_REFERENCE_TYPE}
            AND r."referenceId" = h."id"::text
            AND r."status" IN ('OPEN', 'INVESTIGATING')
        )
      ORDER BY h."releaseEligibleAt", h."id" LIMIT 1
    `;
    return rows[0]?.id ?? null;
  }

  private async processInTransaction(tx: Prisma.TransactionClient, holdId: string) {
    await acquireAdvisoryTransactionLock(tx, `financial:seller-held-release:${holdId}`);
    const rows = await tx.$queryRaw<HoldRow[]>`
      SELECT h.*,
        (h."sellerReleasePolicyVersionId" IS NOT NULL
          AND h."sellerReleasePolicyRuleId" IS NOT NULL
          AND h."releaseDelayHours" IS NOT NULL AND h."releaseDelayHours" >= 0
          AND h."releasePolicyAppliedAt" IS NOT NULL AND h."releaseEligibleAt" IS NOT NULL
          AND h."releaseEligibleAt" =
            (h."releasePolicyAppliedAt" + make_interval(hours => h."releaseDelayHours"))::timestamp(3)
        ) AS "snapshotValid",
        (transaction_timestamp() >= h."releaseEligibleAt") AS "due"
      FROM "FinancialHold" h WHERE h."id" = ${holdId}::uuid FOR UPDATE
    `;
    const hold = rows[0];
    if (!hold) return this.fail(tx, holdId, 'MISSING_LOCAL', 'HOLD_MISSING');
    if (hold.reason !== 'DELIVERY_PROTECTION')
      return this.fail(tx, holdId, 'STATUS_MISMATCH', 'HOLD_INVALID');
    const replay = hold.status === 'RELEASED';
    if (!replay && hold.status !== 'RELEASE_ELIGIBLE')
      return this.fail(tx, holdId, 'STATUS_MISMATCH', 'HOLD_INVALID');
    if (
      hold.amountMinor <= 0n ||
      hold.currency !== 'BRL' ||
      !hold.orderId ||
      !hold.paymentId ||
      !hold.ledgerTransactionId ||
      !hold.snapshotValid ||
      (replay
        ? !hold.releaseLedgerTransactionId || !hold.releasedAt
        : !!hold.releaseLedgerTransactionId || !!hold.releasedAt)
    )
      return this.fail(tx, holdId, 'OTHER', 'HOLD_INVALID');

    const rule = await tx.sellerReleasePolicyRule.findUnique({
      where: {
        id_policyVersionId: {
          id: hold.sellerReleasePolicyRuleId!,
          policyVersionId: hold.sellerReleasePolicyVersionId!,
        },
      },
      select: { code: true, delayHours: true },
    });
    if (rule?.code !== RULE_CODE || rule.delayHours !== hold.releaseDelayHours)
      return this.fail(tx, holdId, 'OTHER', 'HISTORICAL_RELEASE_RULE_INVALID');

    await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${hold.orderId}::uuid FOR UPDATE`;
    const order = await tx.order.findUnique({ where: { id: hold.orderId } });
    if (!order) return this.fail(tx, holdId, 'MISSING_LOCAL', 'ORDER_INVALID');
    const proceeds = order.totalAmountMinor - order.platformFeeAmountMinor;
    if (
      order.currency !== 'BRL' ||
      order.sellerProfileId !== hold.sellerProfileId ||
      proceeds <= 0n ||
      proceeds !== hold.amountMinor
    )
      return this.fail(tx, holdId, 'STATUS_MISMATCH', 'ORDER_INVALID');

    await tx.$queryRaw`SELECT "id" FROM "Payment" WHERE "orderId" = ${order.id}::uuid FOR UPDATE`;
    const payments = await tx.payment.findMany({ where: { orderId: order.id } });
    const payment = payments[0];
    if (
      payments.length !== 1 ||
      !payment ||
      payment.id !== hold.paymentId ||
      !payment.paidAt ||
      payment.currency !== 'BRL' ||
      payment.amountMinor !== order.totalAmountMinor
    )
      return this.fail(tx, holdId, 'OTHER', 'PAYMENT_INVALID');

    const original = await this.postings(tx, 'SELLER_FUNDS_HELD', 'OrderSellerHold', order.id);
    if (
      !this.validPosting(
        original,
        hold,
        'SELLER_PENDING',
        'SELLER_HELD',
        this.originalKey(order.id),
        hold.ledgerTransactionId,
      )
    )
      return this.fail(
        tx,
        holdId,
        original.length ? 'OTHER' : 'MISSING_LOCAL',
        original.length ? 'ORIGINAL_HOLD_POSTING_INVALID' : 'ORIGINAL_HOLD_POSTING_MISSING',
      );

    const releases = await this.postings(tx, LEDGER_TYPE, LEDGER_REFERENCE_TYPE, hold.id);
    if (replay) {
      if (
        !this.validPosting(
          releases,
          hold,
          'SELLER_HELD',
          'SELLER_AVAILABLE',
          this.releaseKey(hold.id),
          hold.releaseLedgerTransactionId,
        )
      )
        return this.fail(tx, holdId, 'OTHER', 'RELEASE_POSTING_INVALID');
      const releasePosting = releases[0];
      if (
        hold.releasedAt!.getTime() < hold.releaseEligibleAt!.getTime() ||
        releasePosting.createdAt.getTime() < hold.releaseEligibleAt!.getTime() ||
        hold.releasedAt!.getTime() !== releasePosting.createdAt.getTime()
      )
        return this.fail(tx, holdId, 'STATUS_MISMATCH', 'SELLER_HELD_FUNDS_RELEASE_TIMING_INVALID');
      return 'ALREADY_RELEASED' as const;
    }
    if (order.disputeStatus === 'OPEN' || order.disputeStatus === 'UNDER_REVIEW')
      return 'BUSINESS_BLOCKED' as const;
    if (
      order.status !== 'COMPLETED' ||
      order.paymentStatus !== 'PAID' ||
      order.fulfillmentStatus !== 'CONFIRMED' ||
      order.disputeStatus !== 'NONE'
    )
      return this.fail(tx, holdId, 'STATUS_MISMATCH', 'ORDER_INVALID');
    if (payment.status !== 'PAID') return this.fail(tx, holdId, 'OTHER', 'PAYMENT_INVALID');
    if (releases.length)
      return this.fail(tx, holdId, 'OTHER', 'RELEASE_POSTING_PARTIAL_OR_INVALID');
    if (!hold.due) return this.fail(tx, holdId, 'STATUS_MISMATCH', 'SELLER_HOLD_RELEASE_PREMATURE');

    const accounts = await tx.ledgerAccount.findMany({
      where: {
        ownerType: 'SELLER',
        ownerId: hold.sellerProfileId,
        currency: 'BRL',
        purpose: { in: ['SELLER_HELD', 'SELLER_AVAILABLE'] },
      },
    });
    const held = accounts.find((account) => account.purpose === 'SELLER_HELD');
    const available = accounts.find((account) => account.purpose === 'SELLER_AVAILABLE');
    if (!held || !available)
      return this.fail(tx, holdId, 'MISSING_LOCAL', 'SELLER_RELEASE_ACCOUNTS_MISSING');
    const outcome = await this.ledger.postWithOutcomeInTransaction(tx, {
      type: LEDGER_TYPE,
      referenceType: LEDGER_REFERENCE_TYPE,
      referenceId: hold.id,
      currency: 'BRL',
      idempotencyKeyHash: this.releaseKey(hold.id),
      emitOutbox: true,
      metadata: {
        financialHoldId: hold.id,
        orderId: order.id,
        sellerProfileId: hold.sellerProfileId,
        amountMinor: hold.amountMinor.toString(),
      },
      entries: [
        { accountId: held.id, direction: 'DEBIT', amountMinor: hold.amountMinor },
        { accountId: available.id, direction: 'CREDIT', amountMinor: hold.amountMinor },
      ],
    });
    if (!outcome.created)
      return this.fail(tx, holdId, 'OTHER', 'RELEASE_POSTING_PARTIAL_OR_INVALID');
    await tx.$executeRaw`
      UPDATE "FinancialHold" SET "status" = 'RELEASED',
        "releaseLedgerTransactionId" = ${outcome.transaction.id}::uuid,
        "releasedAt" = (
          SELECT "createdAt" FROM "LedgerTransaction"
          WHERE "id" = ${outcome.transaction.id}::uuid
        ),
        "updatedAt" = transaction_timestamp()
      WHERE "id" = ${hold.id}::uuid
    `;
    return 'RELEASED' as const;
  }

  private postings(
    tx: Prisma.TransactionClient,
    type: string,
    referenceType: string,
    referenceId: string,
  ) {
    return tx.ledgerTransaction.findMany({
      where: { type, referenceType, referenceId },
      include: { entries: { include: { account: true } } },
    });
  }
  private validPosting(
    postings: Posting[],
    hold: HoldRow,
    debit: string,
    credit: string,
    key: string,
    expectedId: string | null,
  ) {
    if (postings.length !== 1) return false;
    const posting = postings[0];
    if (
      posting.id !== expectedId ||
      posting.currency !== 'BRL' ||
      posting.idempotencyKeyHash !== key ||
      posting.entries.length !== 2
    )
      return false;
    return [
      [debit, 'DEBIT'],
      [credit, 'CREDIT'],
    ].every(([purpose, direction]) =>
      posting.entries.some(
        (entry) =>
          entry.account.ownerType === 'SELLER' &&
          entry.account.ownerId === hold.sellerProfileId &&
          entry.account.sellerProfileId === hold.sellerProfileId &&
          entry.account.purpose === purpose &&
          entry.account.currency === 'BRL' &&
          entry.direction === direction &&
          entry.amountMinor === hold.amountMinor,
      ),
    );
  }
  private fail(
    tx: Prisma.TransactionClient,
    id: string,
    type: ReconciliationIssueType,
    code: string,
  ) {
    return this.ensureIssueInTransaction(tx, id, { type, code }).then(
      () => 'RECONCILIATION_REQUIRED' as const,
    );
  }
  private async ensureIssue(id: string, failure: Failure) {
    await this.prisma.$transaction(async (tx) => {
      await acquireAdvisoryTransactionLock(tx, `financial:seller-held-release-issue:${id}`);
      await this.ensureIssueInTransaction(tx, id, failure);
    });
  }
  private async ensureIssueInTransaction(
    tx: Prisma.TransactionClient,
    id: string,
    failure: Failure,
  ) {
    const existing = await tx.reconciliationIssue.findFirst({
      where: {
        referenceType: ISSUE_REFERENCE_TYPE,
        referenceId: id,
        status: { in: ['OPEN', 'INVESTIGATING'] },
      },
    });
    if (!existing)
      await tx.reconciliationIssue.create({
        data: {
          type: failure.type,
          referenceType: ISSUE_REFERENCE_TYPE,
          referenceId: id,
          details: { errorCode: failure.code },
        },
      });
  }
  private originalKey(id: string) {
    return createHash('sha256').update(`seller-pending-hold:v1:${id}`).digest('hex');
  }
  private releaseKey(id: string) {
    return createHash('sha256').update(`seller-held-release:v1:${id}`).digest('hex');
  }
  private isInsufficientBalance(error: unknown) {
    return error instanceof FinancialDomainError && error.code === 'INSUFFICIENT_FINANCIAL_BALANCE';
  }
  private isSerializationFailure(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2034' || (error.code === 'P2010' && error.meta?.code === '40001'))
    );
  }
}
