import type {
  CatalogProductType,
  BuyerVipPlan,
  FeeFormula,
  FeeParty,
  FeeRule,
  FeeRuleCategory,
  PaymentMethod,
  WithdrawalSpeed,
} from '@prisma/client';
import { FinancialDomainError } from './financial.errors';
export type FeeInput = Pick<
  FeeRule,
  'formula' | 'percentBps' | 'fixedAmountMinor' | 'minimumAmountMinor' | 'maximumAmountMinor'
>;
export type FeeContext = {
  paymentMethod?: PaymentMethod;
  installments?: number;
  sellerLevel?: string;
  sellerPlan?: string;
  buyerVipPlan?: BuyerVipPlan;
  promotionTier?: string;
  withdrawalSpeed?: WithdrawalSpeed;
  productType?: CatalogProductType;
  partyCharged: FeeParty;
};
export type ResolvableFeeRule = FeeInput &
  Pick<
    FeeRule,
    | 'id'
    | 'code'
    | 'category'
    | 'partyCharged'
    | 'paymentMethod'
    | 'installmentsFrom'
    | 'installmentsTo'
    | 'sellerLevel'
    | 'sellerPlan'
    | 'buyerVipPlan'
    | 'promotionTier'
    | 'withdrawalSpeed'
    | 'productType'
    | 'priority'
    | 'enabled'
  >;
export function validateFeeRule(
  rule: FeeInput & Pick<FeeRule, 'installmentsFrom' | 'installmentsTo'>,
) {
  const { formula, percentBps, fixedAmountMinor, minimumAmountMinor, maximumAmountMinor } = rule;
  const validFormula =
    (formula === 'FIXED' && fixedAmountMinor !== null && percentBps === null) ||
    (formula === 'PERCENT_BPS' && percentBps !== null && fixedAmountMinor === null) ||
    (formula === 'PERCENT_BPS_PLUS_FIXED' && percentBps !== null && fixedAmountMinor !== null);
  if (
    !validFormula ||
    (percentBps !== null && percentBps < 0) ||
    [fixedAmountMinor, minimumAmountMinor, maximumAmountMinor].some((x) => x !== null && x < 0n) ||
    (minimumAmountMinor !== null &&
      maximumAmountMinor !== null &&
      minimumAmountMinor > maximumAmountMinor) ||
    (rule.installmentsFrom !== null && rule.installmentsFrom <= 0) ||
    (rule.installmentsTo !== null && rule.installmentsTo <= 0) ||
    (rule.installmentsFrom !== null &&
      rule.installmentsTo !== null &&
      rule.installmentsFrom > rule.installmentsTo)
  )
    throw new FinancialDomainError('INVALID_FEE_RULE');
}
/** Integer-only calculation; basis points round down deterministically. */
export function calculateFee(amountMinor: bigint, rule: FeeInput): bigint {
  if (amountMinor < 0n) throw new FinancialDomainError('INVALID_MONEY');
  validateFeeRule({ ...rule, installmentsFrom: null, installmentsTo: null });
  const percent = rule.percentBps === null ? 0n : BigInt(rule.percentBps);
  const fixed = rule.fixedAmountMinor ?? 0n;
  let result: bigint;
  const formula: FeeFormula = rule.formula;
  if (formula === 'FIXED') result = fixed;
  else if (formula === 'PERCENT_BPS') result = (amountMinor * percent) / 10_000n;
  else result = (amountMinor * percent) / 10_000n + fixed;
  if (rule.minimumAmountMinor !== null && result < rule.minimumAmountMinor)
    result = rule.minimumAmountMinor;
  if (rule.maximumAmountMinor !== null && result > rule.maximumAmountMinor)
    result = rule.maximumAmountMinor;
  return result;
}
function applicable(rule: ResolvableFeeRule, context: FeeContext): boolean {
  const exact = <T>(qualifier: T | null, actual: T | undefined) =>
    qualifier === null || qualifier === actual;
  return (
    rule.enabled &&
    rule.partyCharged === context.partyCharged &&
    exact(rule.paymentMethod, context.paymentMethod) &&
    exact(rule.sellerLevel, context.sellerLevel) &&
    exact(rule.sellerPlan, context.sellerPlan) &&
    exact(rule.buyerVipPlan, context.buyerVipPlan) &&
    exact(rule.promotionTier, context.promotionTier) &&
    exact(rule.withdrawalSpeed, context.withdrawalSpeed) &&
    exact(rule.productType, context.productType) &&
    (rule.installmentsFrom === null ||
      (context.installments !== undefined && context.installments >= rule.installmentsFrom)) &&
    (rule.installmentsTo === null ||
      (context.installments !== undefined && context.installments <= rule.installmentsTo))
  );
}
function specificity(rule: ResolvableFeeRule): number {
  return (
    [
      rule.paymentMethod,
      rule.sellerLevel,
      rule.sellerPlan,
      rule.buyerVipPlan,
      rule.promotionTier,
      rule.withdrawalSpeed,
      rule.productType,
    ].filter((x) => x !== null).length +
    (rule.installmentsFrom !== null || rule.installmentsTo !== null ? 1 : 0)
  );
}
/** Resolves one category without depending on database return order: priority, then specificity. */
export function resolveFeeRule(
  rules: readonly ResolvableFeeRule[],
  category: FeeRuleCategory,
  context: FeeContext,
): ResolvableFeeRule | null {
  const candidates = rules.filter(
    (rule) => rule.category === category && applicable(rule, context),
  );
  if (!candidates.length) return null;
  for (const candidate of candidates) validateFeeRule(candidate);
  const bestPriority = Math.max(...candidates.map((rule) => rule.priority));
  const prioritized = candidates.filter((rule) => rule.priority === bestPriority);
  const bestSpecificity = Math.max(...prioritized.map(specificity));
  const winners = prioritized.filter((rule) => specificity(rule) === bestSpecificity);
  if (winners.length !== 1) throw new FinancialDomainError('FEE_RULE_AMBIGUOUS');
  return winners[0];
}
export function calculateResolvedFee(
  amountMinor: bigint,
  rules: readonly ResolvableFeeRule[],
  category: FeeRuleCategory,
  context: FeeContext,
): bigint {
  const rule = resolveFeeRule(rules, category, context);
  return rule ? calculateFee(amountMinor, rule) : 0n;
}
export function selectEffectivePolicy<T extends { effectiveFrom: Date; effectiveTo: Date | null }>(
  policies: readonly T[],
  at: Date,
): T {
  const matches = policies.filter(
    (p) => p.effectiveFrom <= at && (!p.effectiveTo || at < p.effectiveTo),
  );
  if (matches.length !== 1) throw new FinancialDomainError('POLICY_NOT_FOUND');
  return matches[0];
}
