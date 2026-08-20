import { HttpStatus, Injectable } from '@nestjs/common';
import { ListingDraftPromotionPreference, Prisma } from '@prisma/client';
import { AppError } from '../common/errors/app-error';
import { PrismaService } from '../database/prisma.service';
import { calculateFee, resolveFeeRule } from './fee-engine';
import { FinancialDomainError } from './financial.errors';

type Client = PrismaService | Prisma.TransactionClient;
const TIERS = [
  [ListingDraftPromotionPreference.SILVER, 'Prata'],
  [ListingDraftPromotionPreference.GOLD, 'Ouro'],
  [ListingDraftPromotionPreference.DIAMOND, 'Diamante'],
] as const;

@Injectable()
export class ListingTierPolicyService {
  constructor(private readonly prisma: PrismaService) {}

  private fail(code: string): never {
    throw new AppError(code, code, HttpStatus.UNPROCESSABLE_ENTITY, []);
  }

  private async policy(client: Client, lock = false) {
    const [{ pricingAt }] = await client.$queryRaw<Array<{ pricingAt: Date }>>`
      SELECT transaction_timestamp() AS "pricingAt"
    `;
    const policies = await client.feePolicyVersion.findMany({
      where: {
        status: 'ACTIVE',
        effectiveFrom: { lte: pricingAt },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: pricingAt } }],
      },
      select: { id: true },
    });
    if (policies.length === 0) this.fail('FEE_POLICY_NOT_FOUND');
    if (policies.length !== 1) this.fail('FEE_POLICY_AMBIGUOUS');
    if (lock) {
      const rows = await client.$queryRaw<
        Array<{
          id: string;
          publicVersion: number;
          status: string;
          effectiveFrom: Date;
          effectiveTo: Date | null;
        }>
      >`
        SELECT "id", "publicVersion", "status", "effectiveFrom", "effectiveTo"
        FROM "FeePolicyVersion"
        WHERE "id" = ${policies[0].id}::uuid
        FOR SHARE
      `;
      const locked = rows[0];
      if (
        !locked ||
        locked.status !== 'ACTIVE' ||
        locked.effectiveFrom > pricingAt ||
        (locked.effectiveTo !== null && pricingAt >= locked.effectiveTo)
      )
        this.fail('FEE_POLICY_NOT_FOUND');
    }
    return client.feePolicyVersion.findUniqueOrThrow({
      where: { id: policies[0].id },
      include: { rules: true },
    });
  }

  private exactRule(
    policy: Awaited<ReturnType<ListingTierPolicyService['policy']>>,
    tier: ListingDraftPromotionPreference,
  ) {
    const exact = policy.rules.filter(
      (rule) =>
        rule.enabled && rule.category === 'PLATFORM_COMMISSION' && rule.promotionTier === tier,
    );
    if (exact.length === 0) this.fail('LISTING_TIER_FEE_RULE_NOT_FOUND');
    let rule;
    try {
      rule = resolveFeeRule(exact, 'PLATFORM_COMMISSION', {
        partyCharged: 'SELLER',
        promotionTier: tier,
      });
    } catch (error) {
      if (error instanceof FinancialDomainError) this.fail(error.code);
      throw error;
    }
    if (!rule) this.fail('LISTING_TIER_FEE_RULE_NOT_FOUND');
    const canonical =
      exact.length === 1 &&
      rule.partyCharged === 'SELLER' &&
      rule.formula === 'PERCENT_BPS' &&
      rule.percentBps !== null &&
      rule.fixedAmountMinor === null &&
      rule.minimumAmountMinor === null &&
      rule.maximumAmountMinor === null &&
      rule.paymentMethod === null &&
      rule.installmentsFrom === null &&
      rule.installmentsTo === null &&
      rule.sellerLevel === null &&
      rule.sellerPlan === null &&
      rule.withdrawalSpeed === null &&
      rule.productType === null;
    if (!canonical) this.fail('LISTING_TIER_FEE_RULE_INVALID');
    return rule;
  }

  async resolve(client: Client, tier: ListingDraftPromotionPreference, amountMinor: bigint) {
    const policy = await this.policy(client, true);
    const rule = this.exactRule(policy, tier);
    const amount = calculateFee(amountMinor, rule);
    if (amount < 0n || amount > amountMinor) this.fail('PLATFORM_COMMISSION_EXCEEDS_ORDER_TOTAL');
    return { policy, rule, amountMinor: amount };
  }

  async options() {
    const policy = await this.policy(this.prisma);
    return {
      policyVersion: { id: policy.id, publicVersion: policy.publicVersion },
      items: TIERS.map(([tier, label]) => {
        const rule = this.exactRule(policy, tier);
        return { tier, label, percentBps: rule.percentBps! };
      }),
    };
  }
}
