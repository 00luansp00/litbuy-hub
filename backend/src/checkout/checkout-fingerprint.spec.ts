import { checkoutFingerprint } from './checkout-fingerprint';
const base = {
  cartId: 'c',
  cartVersion: 1,
  sellerId: 's',
  currency: 'BRL',
  items: [
    {
      id: 'i',
      productId: 'p',
      productVersion: 1,
      variantId: null,
      quantity: 1,
      unitAmountMinor: '100',
      purchasable: true,
      issues: [],
    },
  ],
};
describe('checkout fingerprint', () => {
  it('is deterministic', () => expect(checkoutFingerprint(base)).toBe(checkoutFingerprint(base)));
  it('changes with price and product version', () => {
    expect(checkoutFingerprint(base)).not.toBe(
      checkoutFingerprint({ ...base, items: [{ ...base.items[0], unitAmountMinor: '101' }] }),
    );
    expect(checkoutFingerprint(base)).not.toBe(
      checkoutFingerprint({ ...base, items: [{ ...base.items[0], productVersion: 2 }] }),
    );
  });
  it('rejects multiple selections', () => {
    expect(() =>
      checkoutFingerprint({ ...base, items: [base.items[0], { ...base.items[0], id: 'other' }] }),
    ).toThrow('CHECKOUT_SELECTION_CARDINALITY_INVALID');
  });
});
