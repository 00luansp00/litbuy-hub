import { createHash } from 'node:crypto';
import type { BuyerVipPlan } from '@prisma/client';

export type FingerprintItem = {
  id: string;
  productId: string;
  productVersion: number;
  variantId: string | null;
  quantity: number;
  unitAmountMinor: string | null;
  purchasable: boolean;
  issues: string[];
};
export function checkoutFingerprint(input: {
  cartId: string;
  cartVersion: number;
  sellerId: string;
  currency: string;
  items: FingerprintItem[];
}) {
  if (input.items.length > 1) throw new Error('CHECKOUT_SELECTION_CARDINALITY_INVALID');
  const canonical = JSON.stringify({
    ...input,
    items: [...input.items]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((i) => ({ ...i, issues: [...i.issues].sort() })),
  });
  return `sha256:${createHash('sha256').update(canonical).digest('hex')}`;
}

export function buyerVipCheckoutFingerprint(
  previewFingerprint: string,
  quote:
    | BuyerVipPlan
    | {
        plan: BuyerVipPlan;
        policyId: string;
        pricingPolicyVersion: number;
        ruleId: string | null;
        percentBps: number;
        baseAmountMinor: bigint | string;
        feeAmountMinor: bigint | string;
        totalAmountMinor: bigint | string;
      },
) {
  const buyerVipQuote =
    typeof quote === 'string'
      ? { plan: quote }
      : {
          ...quote,
          baseAmountMinor: quote.baseAmountMinor.toString(),
          feeAmountMinor: quote.feeAmountMinor.toString(),
          totalAmountMinor: quote.totalAmountMinor.toString(),
        };
  const canonical = JSON.stringify({ previewFingerprint, buyerVipQuote });
  return `sha256:${createHash('sha256').update(canonical).digest('hex')}`;
}
