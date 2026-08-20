import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import {
  FeeParty,
  FeeRuleCategory,
  LedgerTransaction,
  OrderStatus,
  PaymentStatus,
  Prisma,
  ReconciliationIssueType,
} from '@prisma/client';
import { acquireAdvisoryTransactionLock } from '../database/advisory-lock';
import { PrismaService } from '../database/prisma.service';
import { FinancialDomainError } from './financial.errors';
import { FinancialLedgerService, PostRequest } from './financial-ledger.service';

export const SALE_RECOGNITION_LEDGER_TYPE = 'SALE_RECOGNIZED';
export const SALE_RECOGNITION_REFERENCE_TYPE = 'OrderSale';
export const SALE_RECOGNITION_RECONCILIATION_REFERENCE_TYPE = 'SaleFinancialRecognition';

export function saleRecognitionIdempotencyKey(orderId: string): string {
  return createHash('sha256').update(`sale-recognition:v1:${orderId}`).digest('hex');
}

const LEDGER_TYPE = SALE_RECOGNITION_LEDGER_TYPE;
const LEDGER_REFERENCE_TYPE = SALE_RECOGNITION_REFERENCE_TYPE;
const RECONCILIATION_REFERENCE_TYPE = SALE_RECOGNITION_RECONCILIATION_REFERENCE_TYPE;

type CandidateResult = 'NO_CANDIDATE' | 'ALREADY_HANDLED' | 'PROCESSED';
type Failure = { type: ReconciliationIssueType; code: string };

type OrderSnapshot = {
  id: string;
  sellerProfileId: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  currency: string;
  totalAmountMinor: bigint;
  subtotalAmountMinor: bigint;
  platformFeeAmountMinor: bigint;
  pricingPolicyVersion: number;
  feePolicyVersionId: string | null;
  platformCommissionRuleId: string | null;
  feeSnapshotVersion: number | null;
};

type FeeComponentSnapshot = {
  feePolicyVersionId: string;
  feeRuleId: string;
  pricingPolicyVersion: number;
  listingTier: string;
  category: string;
  partyCharged: string;
  formula: string;
  percentBps: number;
  baseAmountMinor: bigint;
  feeAmountMinor: bigint;
  currency: string;
};

type PaymentSnapshot = {
  id: string;
  orderId: string;
  status: PaymentStatus;
  paidAt: Date | null;
  amountMinor: bigint;
  currency: string;
};

type AttemptSnapshot = {
  id: string;
  paymentId: string;
  providerCode: string;
  externalPaymentId: string | null;
  amountMinor: bigint;
  currency: string;
};

@Injectable()
export class SaleFinancialRecognitionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: FinancialLedgerService,
  ) {}

  async processOne(orderId?: string): Promise<boolean> {
    return (await this.processCandidate(orderId)) !== 'NO_CANDIDATE';
  }

  async processBatch(limit = 25): Promise<number> {
    let processed = 0;
    const bounded = Math.max(1, Math.min(limit, 100));
    while (processed < bounded) {
      const result = await this.processCandidate();
      if (result === 'NO_CANDIDATE') break;
      if (result === 'PROCESSED') processed += 1;
    }
    return processed;
  }

  private async processCandidate(orderId?: string): Promise<CandidateResult> {
    const id = orderId ?? (await this.nextCandidate());
    if (!id) return 'NO_CANDIDATE';
    return this.processOrder(id);
  }

  private async processOrder(orderId: string): Promise<CandidateResult> {
    const expectedKey = saleRecognitionIdempotencyKey(orderId);
    const existing = await this.findExistingRecognitions(orderId);
    const existingState = this.validateExistingRecognition(orderId, expectedKey, existing);
    if (existingState === 'MISMATCH') {
      await this.ensureIssue(orderId, { type: 'OTHER', code: 'SALE_LEDGER_IDEMPOTENCY_MISMATCH' });
      return 'PROCESSED';
    }

    const validation = await this.validate(orderId);
    if ('failure' in validation) {
      await this.ensureIssue(orderId, validation.failure);
      return 'PROCESSED';
    }

    const request = await this.buildPostRequest(validation.order, validation.payment, expectedKey);
    try {
      const outcome = await this.ledger.postWithOutcome(request);
      return outcome.created ? 'PROCESSED' : 'ALREADY_HANDLED';
    } catch (error) {
      if (error instanceof FinancialDomainError) {
        if (error.code === 'FINANCIAL_CONCURRENCY_CONFLICT') throw error;
        const code =
          error.code === 'IDEMPOTENCY_KEY_REUSED'
            ? 'SALE_LEDGER_IDEMPOTENCY_MISMATCH'
            : error.code === 'INVALID_MONEY'
              ? 'SALE_LEDGER_POSTING_FAILED'
              : undefined;
        if (code) {
          await this.ensureIssue(orderId, { type: 'OTHER', code });
          return 'PROCESSED';
        }
      }
      if (this.isUniqueSaleRecognitionConflict(error)) {
        await this.ensureIssue(orderId, {
          type: 'OTHER',
          code: 'SALE_LEDGER_IDEMPOTENCY_MISMATCH',
        });
        return 'PROCESSED';
      }
      throw error;
    }
  }

  private async nextCandidate(): Promise<string | null> {
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT o."id"
      FROM "Order" o
      JOIN "Payment" p ON p."orderId" = o."id"
      WHERE o."status" = 'ACTIVE'
        AND o."paymentStatus" = 'PAID'
        AND p."status" = 'PAID'
        AND p."paidAt" IS NOT NULL
        AND p."currency" = 'BRL'
        AND NOT EXISTS (
          SELECT 1 FROM "LedgerTransaction" lt
          WHERE lt."type" = ${LEDGER_TYPE}
            AND lt."referenceType" = ${LEDGER_REFERENCE_TYPE}
            AND lt."referenceId" = o."id"
        )
        AND NOT EXISTS (
          SELECT 1 FROM "ReconciliationIssue" r
          WHERE r."referenceType" = ${RECONCILIATION_REFERENCE_TYPE}
            AND r."referenceId" = o."id"::text
            AND r."status" IN ('OPEN', 'INVESTIGATING')
        )
      ORDER BY p."paidAt", o."id"
      LIMIT 1
    `;
    return rows[0]?.id ?? null;
  }

  private async findExistingRecognitions(orderId: string) {
    return this.prisma.ledgerTransaction.findMany({
      where: { type: LEDGER_TYPE, referenceType: LEDGER_REFERENCE_TYPE, referenceId: orderId },
      orderBy: { createdAt: 'asc' },
    });
  }

  private validateExistingRecognition(
    orderId: string,
    expectedKey: string,
    existing: LedgerTransaction[],
  ): 'NONE' | 'EXPECTED' | 'MISMATCH' {
    if (existing.length === 0) return 'NONE';
    if (existing.length !== 1) return 'MISMATCH';
    const transaction = existing[0];
    if (
      transaction.idempotencyKeyHash !== expectedKey ||
      transaction.currency !== 'BRL' ||
      transaction.type !== LEDGER_TYPE ||
      transaction.referenceType !== LEDGER_REFERENCE_TYPE ||
      transaction.referenceId !== orderId
    )
      return 'MISMATCH';
    return 'EXPECTED';
  }

  private async validate(
    orderId: string,
  ): Promise<{ order: OrderSnapshot; payment: PaymentSnapshot } | { failure: Failure }> {
    return this.prisma.$transaction(async (tx) => {
      const orders = await tx.$queryRaw<OrderSnapshot[]>`
        SELECT "id", "sellerProfileId", "status", "paymentStatus", "currency", "subtotalAmountMinor", "totalAmountMinor",
               "platformFeeAmountMinor", "pricingPolicyVersion", "feePolicyVersionId", "platformCommissionRuleId", "feeSnapshotVersion"
        FROM "Order" WHERE "id" = ${orderId}::uuid FOR UPDATE
      `;
      const order = orders[0];
      if (!order) return { failure: { type: 'MISSING_LOCAL', code: 'ORDER_MISSING' } };
      if (order.status !== OrderStatus.ACTIVE)
        return { failure: { type: 'STATUS_MISMATCH', code: 'ORDER_NOT_ACTIVE' } };
      if (order.paymentStatus !== PaymentStatus.PAID)
        return { failure: { type: 'STATUS_MISMATCH', code: 'ORDER_PAYMENT_STATUS_MISMATCH' } };
      if (order.currency !== 'BRL')
        return { failure: { type: 'OTHER', code: 'PAYMENT_CURRENCY_MISMATCH' } };
      if (
        order.totalAmountMinor <= 0n ||
        order.platformFeeAmountMinor < 0n ||
        order.platformFeeAmountMinor > order.totalAmountMinor
      )
        return { failure: { type: 'AMOUNT_MISMATCH', code: 'INVALID_COMMISSION_SNAPSHOT' } };
      if (!order.feePolicyVersionId || !order.platformCommissionRuleId)
        return { failure: { type: 'MISSING_LOCAL', code: 'ORDER_PRICING_SNAPSHOT_MISSING' } };

      let component: FeeComponentSnapshot | undefined;
      if (order.feeSnapshotVersion === 1) {
        const components = await tx.$queryRaw<FeeComponentSnapshot[]>`
          SELECT "feePolicyVersionId", "feeRuleId", "pricingPolicyVersion", "listingTier",
                 "category", "partyCharged", "formula", "percentBps", "baseAmountMinor",
                 "feeAmountMinor", "currency"
          FROM "OrderFeeComponentSnapshot"
          WHERE "orderId" = ${orderId}::uuid AND "componentKind" = 'LISTING_TIER'
          FOR SHARE
        `;
        if (components.length !== 1)
          return { failure: { type: 'MISSING_LOCAL', code: 'H2_FEE_SNAPSHOT_INVALID' } };
        component = components[0];
        if (
          component.feePolicyVersionId !== order.feePolicyVersionId ||
          component.feeRuleId !== order.platformCommissionRuleId ||
          component.pricingPolicyVersion !== order.pricingPolicyVersion ||
          component.category !== 'PLATFORM_COMMISSION' ||
          component.partyCharged !== 'SELLER' ||
          component.formula !== 'PERCENT_BPS' ||
          component.percentBps < 0 ||
          !['SILVER', 'GOLD', 'DIAMOND'].includes(component.listingTier) ||
          component.baseAmountMinor !== order.subtotalAmountMinor ||
          component.feeAmountMinor !== order.platformFeeAmountMinor ||
          component.currency !== order.currency ||
          (component.baseAmountMinor * BigInt(component.percentBps)) / 10_000n !==
            component.feeAmountMinor
        )
          return { failure: { type: 'AMOUNT_MISMATCH', code: 'H2_FEE_SNAPSHOT_INVALID' } };
      } else if (order.feeSnapshotVersion !== null) {
        return { failure: { type: 'OTHER', code: 'H2_FEE_SNAPSHOT_VERSION_UNSUPPORTED' } };
      }

      const payments = await tx.$queryRaw<PaymentSnapshot[]>`
        SELECT "id", "orderId", "status", "paidAt", "amountMinor", "currency"
        FROM "Payment" WHERE "orderId" = ${orderId}::uuid FOR UPDATE
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

      const attempts = await tx.$queryRaw<AttemptSnapshot[]>`
        SELECT "id", "paymentId", "providerCode", "externalPaymentId", "amountMinor", "currency"
        FROM "PaymentAttempt" WHERE "paymentId" = ${payment.id}::uuid AND "status" = 'SUCCEEDED' FOR UPDATE
      `;
      if (attempts.length !== 1)
        return {
          failure: {
            type: 'STATUS_MISMATCH',
            code: attempts.length ? 'MULTIPLE_SUCCEEDED_ATTEMPTS' : 'SUCCEEDED_ATTEMPT_MISSING',
          },
        };
      const attempt = attempts[0];
      if (attempt.paymentId !== payment.id)
        return { failure: { type: 'STATUS_MISMATCH', code: 'SUCCEEDED_ATTEMPT_MISMATCH' } };
      if (attempt.currency !== 'BRL' || attempt.amountMinor !== payment.amountMinor)
        return { failure: { type: 'AMOUNT_MISMATCH', code: 'SUCCEEDED_ATTEMPT_MISMATCH' } };
      if (!attempt.providerCode.trim() || !attempt.externalPaymentId)
        return { failure: { type: 'STATUS_MISMATCH', code: 'SUCCEEDED_ATTEMPT_MISMATCH' } };

      const policy = await tx.feePolicyVersion.findUnique({
        where: { id: order.feePolicyVersionId },
      });
      if (!policy || policy.publicVersion !== order.pricingPolicyVersion)
        return { failure: { type: 'OTHER', code: 'PRICING_POLICY_VERSION_MISMATCH' } };
      const rule = await tx.feeRule.findUnique({
        where: {
          id_policyVersionId: {
            id: order.platformCommissionRuleId,
            policyVersionId: order.feePolicyVersionId,
          },
        },
      });
      if (!rule || rule.policyVersionId !== order.feePolicyVersionId)
        return { failure: { type: 'OTHER', code: 'COMMISSION_RULE_MISMATCH' } };
      if (rule.category !== FeeRuleCategory.PLATFORM_COMMISSION)
        return { failure: { type: 'OTHER', code: 'COMMISSION_RULE_MISMATCH' } };
      if (rule.partyCharged !== FeeParty.SELLER)
        return { failure: { type: 'OTHER', code: 'COMMISSION_RULE_MISMATCH' } };
      if (
        component &&
        (rule.formula !== 'PERCENT_BPS' ||
          rule.percentBps !== component.percentBps ||
          rule.promotionTier !== component.listingTier ||
          !rule.enabled ||
          rule.fixedAmountMinor !== null ||
          rule.minimumAmountMinor !== null ||
          rule.maximumAmountMinor !== null ||
          rule.paymentMethod !== null ||
          rule.installmentsFrom !== null ||
          rule.installmentsTo !== null ||
          rule.sellerLevel !== null ||
          rule.sellerPlan !== null ||
          rule.withdrawalSpeed !== null ||
          rule.productType !== null)
      )
        return { failure: { type: 'OTHER', code: 'H2_FEE_SNAPSHOT_INVALID' } };
      return { order, payment };
    });
  }

  private async buildPostRequest(
    order: OrderSnapshot,
    payment: PaymentSnapshot,
    idempotencyKeyHash: string,
  ): Promise<PostRequest> {
    const [systemAccounts, platformAccounts, sellerAccounts] = await Promise.all([
      this.ledger.ensureSystemLedgerAccounts(),
      this.ledger.ensurePlatformLedgerAccounts(),
      this.ledger.ensureSellerLedgerAccounts(order.sellerProfileId),
    ]);
    const providerClearing = systemAccounts.find((a) => a.purpose === 'PROVIDER_CLEARING')!;
    const platformCommission = platformAccounts.find((a) => a.purpose === 'PLATFORM_COMMISSION')!;
    const sellerPending = sellerAccounts.find((a) => a.purpose === 'SELLER_PENDING')!;
    const grossAmountMinor = order.totalAmountMinor;
    const platformCommissionMinor = order.platformFeeAmountMinor;
    const sellerProceedsMinor = grossAmountMinor - platformCommissionMinor;
    return {
      type: LEDGER_TYPE,
      currency: 'BRL',
      idempotencyKeyHash,
      referenceType: LEDGER_REFERENCE_TYPE,
      referenceId: order.id,
      emitOutbox: true,
      metadata: {
        orderId: order.id,
        paymentId: payment.id,
        sellerProfileId: order.sellerProfileId,
        feePolicyVersionId: order.feePolicyVersionId,
        platformCommissionRuleId: order.platformCommissionRuleId,
        pricingPolicyVersion: String(order.pricingPolicyVersion),
        grossAmountMinor: grossAmountMinor.toString(),
        platformCommissionMinor: platformCommissionMinor.toString(),
        sellerProceedsMinor: sellerProceedsMinor.toString(),
      },
      entries: [
        { accountId: providerClearing.id, direction: 'DEBIT', amountMinor: grossAmountMinor },
        ...(sellerProceedsMinor > 0n
          ? [
              {
                accountId: sellerPending.id,
                direction: 'CREDIT' as const,
                amountMinor: sellerProceedsMinor,
              },
            ]
          : []),
        ...(platformCommissionMinor > 0n
          ? [
              {
                accountId: platformCommission.id,
                direction: 'CREDIT' as const,
                amountMinor: platformCommissionMinor,
              },
            ]
          : []),
      ],
    };
  }

  private async ensureIssue(orderId: string, failure: Failure) {
    await this.prisma.$transaction(async (tx) => {
      await acquireAdvisoryTransactionLock(tx, `financial:sale-recognition-issue:${orderId}`);
      const existing = await tx.reconciliationIssue.findFirst({
        where: {
          referenceType: RECONCILIATION_REFERENCE_TYPE,
          referenceId: orderId,
          status: { in: ['OPEN', 'INVESTIGATING'] },
        },
      });
      if (!existing)
        await tx.reconciliationIssue.create({
          data: {
            type: failure.type,
            referenceType: RECONCILIATION_REFERENCE_TYPE,
            referenceId: orderId,
            details: { errorCode: failure.code },
          },
        });
    });
  }

  private isUniqueSaleRecognitionConflict(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }
}
