import type { FeeFormula, FeeRule } from '@prisma/client';
import { FinancialDomainError } from './financial.errors';
export type FeeInput = Pick<
  FeeRule,
  'formula' | 'percentBps' | 'fixedAmountMinor' | 'minimumAmountMinor' | 'maximumAmountMinor'
>;
/** Integer-only calculation; basis points round down deterministically. */
export function calculateFee(amountMinor: bigint, rule: FeeInput): bigint {
  if (amountMinor < 0n) throw new FinancialDomainError('INVALID_MONEY');
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
