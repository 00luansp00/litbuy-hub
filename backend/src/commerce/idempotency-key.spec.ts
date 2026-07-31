import { canonicalRequestHash, parseIdempotencyKey, sha256 } from './idempotency-key';
describe('commerce idempotency', () => {
  it('validates and hashes without retaining raw keys', () =>
    expect(parseIdempotencyKey('checkout-key-0001')).toBe(sha256('checkout-key-0001')));
  it('rejects absent and malformed keys', () => {
    expect(() => parseIdempotencyKey(undefined)).toThrow('IDEMPOTENCY_KEY_REQUIRED');
    expect(() => parseIdempotencyKey('short')).toThrow('IDEMPOTENCY_KEY_INVALID');
  });
  it('canonicalizes object keys', () =>
    expect(canonicalRequestHash({ b: 2, a: 1 })).toBe(canonicalRequestHash({ a: 1, b: 2 })));
});
