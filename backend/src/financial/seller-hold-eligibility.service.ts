import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Prisma, ReconciliationIssueType } from '@prisma/client';
import { acquireAdvisoryTransactionLock } from '../database/advisory-lock';
import { PrismaService } from '../database/prisma.service';
import { effectiveReleaseDeadline } from './seller-max-release-calculator';

const ISSUE_REFERENCE_TYPE = 'SellerHoldEligibility';

export type SellerHoldEligibilityResult =
  | 'NO_CANDIDATE'
  | 'NOT_DUE'
  | 'BUSINESS_BLOCKED'
  | 'ALREADY_ELIGIBLE'
  | 'RELEASE_ELIGIBLE'
  | 'RECONCILIATION_REQUIRED';

type Failure = { type: ReconciliationIssueType; code: string };
type HoldRow = {
  id: string;
  orderId: string | null;
  paymentId: string | null;
  sellerProfileId: string;
  ledgerTransactionId: string | null;
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

@Injectable()
export class SellerHoldEligibilityService {
  constructor(private readonly prisma: PrismaService) {}

  async processOne(holdId?: string): Promise<SellerHoldEligibilityResult> {
    const id = holdId ?? (await this.nextCandidate());
    if (!id) return 'NO_CANDIDATE';
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        return await this.prisma.$transaction((tx) => this.processInTransaction(tx, id), {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (error) {
        if (!this.isSerializationFailure(error) || attempt === 3) throw error;
      }
    }
    throw new Error('unreachable');
  }

  async processBatch(limit = 25): Promise<number> {
    const ids = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT h."id"
      FROM "FinancialHold" h
      JOIN "Order" o ON o."id" = h."orderId"
      WHERE h."reason" = 'DELIVERY_PROTECTION'
        AND h."status" = 'ACTIVE'
        AND h."releaseEligibleAt" IS NOT NULL
        AND COALESCE(o."sellerMaxEffectiveReleaseAt", h."releaseEligibleAt") <= transaction_timestamp()
        AND NOT EXISTS (
          SELECT 1 FROM "ReconciliationIssue" r
          WHERE r."referenceType" = ${ISSUE_REFERENCE_TYPE}
            AND r."referenceId" = h."id"::text
            AND r."status" IN ('OPEN', 'INVESTIGATING')
        )
      ORDER BY COALESCE(o."sellerMaxEffectiveReleaseAt", h."releaseEligibleAt"), h."id"
      LIMIT ${Math.max(1, Math.min(limit, 100))}
    `;
    const results = await Promise.all(ids.map(({ id }) => this.processOne(id)));
    return results.filter((result) => result === 'RELEASE_ELIGIBLE').length;
  }

  private async nextCandidate(): Promise<string | null> {
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT h."id" FROM "FinancialHold" h
      WHERE h."reason" = 'DELIVERY_PROTECTION' AND h."status" = 'ACTIVE'
        AND NOT EXISTS (
          SELECT 1 FROM "ReconciliationIssue" r
          WHERE r."referenceType" = ${ISSUE_REFERENCE_TYPE}
            AND r."referenceId" = h."id"::text
            AND r."status" IN ('OPEN', 'INVESTIGATING')
        )
      ORDER BY h."releaseEligibleAt" NULLS FIRST, h."id" LIMIT 1
    `;
    return rows[0]?.id ?? null;
  }

  private async processInTransaction(
    tx: Prisma.TransactionClient,
    holdId: string,
  ): Promise<SellerHoldEligibilityResult> {
    await acquireAdvisoryTransactionLock(tx, `financial:seller-hold-eligibility:${holdId}`);
    const holds = await tx.$queryRaw<HoldRow[]>`
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
    const hold = holds[0];
    if (!hold) return this.fail(tx, holdId, { type: 'MISSING_LOCAL', code: 'HOLD_MISSING' });
    if (hold.reason !== 'DELIVERY_PROTECTION')
      return this.fail(tx, holdId, { type: 'STATUS_MISMATCH', code: 'HOLD_REASON_INVALID' });
    const replay = hold.status === 'RELEASE_ELIGIBLE';
    if (!replay && hold.status !== 'ACTIVE')
      return this.fail(tx, holdId, { type: 'STATUS_MISMATCH', code: 'HOLD_STATUS_INVALID' });
    if (
      hold.amountMinor <= 0n ||
      hold.currency !== 'BRL' ||
      !hold.orderId ||
      !hold.paymentId ||
      !hold.ledgerTransactionId ||
      hold.releasedAt ||
      !hold.snapshotValid
    )
      return this.fail(tx, holdId, { type: 'OTHER', code: 'HOLD_SNAPSHOT_OR_BASE_INVALID' });

    const rule = await tx.sellerReleasePolicyRule.findUnique({
      where: {
        id_policyVersionId: {
          id: hold.sellerReleasePolicyRuleId!,
          policyVersionId: hold.sellerReleasePolicyVersionId!,
        },
      },
      select: { scope: true, delayHours: true },
    });
    const order = await tx.order.findUnique({ where: { id: hold.orderId } });
    if (!order) return this.fail(tx, holdId, { type: 'MISSING_LOCAL', code: 'ORDER_MISSING' });
    const orderSnapshotComplete =
      order.sellerReleasePolicyVersionId !== null &&
      order.sellerReleasePolicyRuleId !== null &&
      order.sellerReleasePolicySource !== null &&
      order.sellerReleasePolicyCategoryId !== null &&
      order.frozenBaseReleaseDelayHours !== null;
    const orderSnapshotEmpty =
      order.sellerReleasePolicyVersionId === null &&
      order.sellerReleasePolicyRuleId === null &&
      order.sellerReleasePolicySource === null &&
      order.sellerReleasePolicyCategoryId === null &&
      order.sellerReleasePolicySubcategoryId === null &&
      order.frozenBaseReleaseDelayHours === null;
    if (
      rule?.delayHours !== hold.releaseDelayHours ||
      (orderSnapshotComplete
        ? rule.scope !== order.sellerReleasePolicySource ||
          hold.sellerReleasePolicyVersionId !== order.sellerReleasePolicyVersionId ||
          hold.sellerReleasePolicyRuleId !== order.sellerReleasePolicyRuleId ||
          hold.releaseDelayHours !== order.frozenBaseReleaseDelayHours
        : !orderSnapshotEmpty || rule.scope !== 'DEFAULT')
    )
      return this.fail(tx, holdId, { type: 'OTHER', code: 'HISTORICAL_RELEASE_RULE_INVALID' });
    const proceeds = order.totalAmountMinor - order.platformFeeAmountMinor;
    if (
      proceeds <= 0n ||
      order.currency !== 'BRL' ||
      order.sellerProfileId !== hold.sellerProfileId ||
      proceeds !== hold.amountMinor
    )
      return this.fail(tx, holdId, { type: 'AMOUNT_MISMATCH', code: 'HOLD_ORDER_INVALID' });

    const deliveries = await tx.orderDelivery.findMany({ where: { orderId: order.id } });
    const delivery = deliveries[0];
    if (
      deliveries.length !== 1 ||
      !delivery ||
      delivery.sellerProfileId !== order.sellerProfileId ||
      delivery.createdAt.getTime() !== hold.releasePolicyAppliedAt!.getTime()
    )
      return this.fail(tx, holdId, { type: 'OTHER', code: 'DELIVERY_AUTHORITY_INVALID' });
    const effective = effectiveReleaseDeadline(order, delivery.createdAt, hold.releaseEligibleAt!);
    if (!effective.valid)
      return this.fail(tx, holdId, { type: 'OTHER', code: 'SELLER_MAX_RELEASE_SNAPSHOT_INVALID' });
    const [{ now }] = await tx.$queryRaw<
      Array<{ now: Date }>
    >`SELECT transaction_timestamp()::timestamp(3) AS "now"`;
    hold.due = now.getTime() >= effective.effectiveDueAt.getTime();

    const payments = await tx.payment.findMany({ where: { orderId: order.id } });
    const payment = payments[0];
    if (
      payments.length !== 1 ||
      !payment ||
      payment.id !== hold.paymentId ||
      payment.status !== 'PAID' ||
      !payment.paidAt ||
      payment.currency !== 'BRL' ||
      payment.amountMinor !== order.totalAmountMinor
    )
      return this.fail(tx, holdId, { type: 'OTHER', code: 'PAYMENT_INVALID' });

    const postings = await tx.ledgerTransaction.findMany({
      where: {
        type: 'SELLER_FUNDS_HELD',
        referenceType: 'OrderSellerHold',
        referenceId: order.id,
      },
      include: { entries: { include: { account: true } } },
    });
    if (!this.validPosting(postings, hold, proceeds))
      return this.fail(tx, holdId, {
        type: postings.length ? 'OTHER' : 'MISSING_LOCAL',
        code: postings.length ? 'SELLER_HOLD_POSTING_INVALID' : 'SELLER_HOLD_POSTING_MISSING',
      });
    if (replay) {
      if (!hold.due)
        return this.fail(tx, holdId, {
          type: 'STATUS_MISMATCH',
          code: 'SELLER_HOLD_ELIGIBILITY_PREMATURE',
        });
      return 'ALREADY_ELIGIBLE';
    }
    const validPostDeliveryState =
      (order.status === 'ACTIVE' && order.fulfillmentStatus === 'AWAITING_BUYER_CONFIRMATION') ||
      (order.status === 'COMPLETED' && order.fulfillmentStatus === 'CONFIRMED');
    if (order.paymentStatus !== 'PAID' || !validPostDeliveryState)
      return this.fail(tx, holdId, { type: 'STATUS_MISMATCH', code: 'ORDER_STATE_INVALID' });
    if (['OPEN', 'UNDER_REVIEW', 'RESOLVED_BUYER', 'CLOSED'].includes(order.disputeStatus))
      return 'BUSINESS_BLOCKED';
    if (!['NONE', 'RESOLVED_SELLER'].includes(order.disputeStatus))
      return this.fail(tx, holdId, { type: 'STATUS_MISMATCH', code: 'ORDER_DISPUTE_INVALID' });
    if (!hold.due) return 'NOT_DUE';

    await tx.financialHold.update({ where: { id: hold.id }, data: { status: 'RELEASE_ELIGIBLE' } });
    return 'RELEASE_ELIGIBLE';
  }

  private validPosting(
    postings: Array<
      Prisma.LedgerTransactionGetPayload<{ include: { entries: { include: { account: true } } } }>
    >,
    hold: HoldRow,
    proceeds: bigint,
  ) {
    if (postings.length !== 1) return false;
    const posting = postings[0];
    if (
      posting.id !== hold.ledgerTransactionId ||
      posting.currency !== 'BRL' ||
      posting.idempotencyKeyHash !== this.holdKey(hold.orderId!) ||
      posting.entries.length !== 2
    )
      return false;
    return ['SELLER_PENDING', 'SELLER_HELD'].every((purpose, index) =>
      posting.entries.some(
        (entry) =>
          entry.account.ownerType === 'SELLER' &&
          entry.account.ownerId === hold.sellerProfileId &&
          entry.account.purpose === purpose &&
          entry.direction === (index === 0 ? 'DEBIT' : 'CREDIT') &&
          entry.amountMinor === proceeds,
      ),
    );
  }

  private async fail(tx: Prisma.TransactionClient, holdId: string, failure: Failure) {
    const existing = await tx.reconciliationIssue.findFirst({
      where: {
        referenceType: ISSUE_REFERENCE_TYPE,
        referenceId: holdId,
        status: { in: ['OPEN', 'INVESTIGATING'] },
      },
    });
    if (!existing)
      await tx.reconciliationIssue.create({
        data: {
          type: failure.type,
          referenceType: ISSUE_REFERENCE_TYPE,
          referenceId: holdId,
          details: { errorCode: failure.code },
        },
      });
    return 'RECONCILIATION_REQUIRED' as const;
  }

  private holdKey(orderId: string) {
    return createHash('sha256').update(`seller-pending-hold:v1:${orderId}`).digest('hex');
  }

  private isSerializationFailure(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2034' ||
        (error.code === 'P2010' &&
          typeof error.meta?.code === 'string' &&
          error.meta.code === '40001'))
    );
  }
}
