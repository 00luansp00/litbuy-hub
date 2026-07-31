import { createHash } from 'node:crypto';

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
  const canonical = JSON.stringify({
    ...input,
    items: [...input.items]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((i) => ({ ...i, issues: [...i.issues].sort() })),
  });
  return `sha256:${createHash('sha256').update(canonical).digest('hex')}`;
}
