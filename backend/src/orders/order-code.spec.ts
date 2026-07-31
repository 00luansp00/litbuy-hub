import { generateOrderCode } from './order-code';
describe('public order code', () => {
  it('has a non-sequential safe format', () =>
    expect(generateOrderCode(() => Buffer.alloc(14, 3))).toMatch(/^LIT-[23456789A-HJ-NP-Z]{14}$/));
  it('uses fresh entropy', () => expect(generateOrderCode()).not.toBe(generateOrderCode()));
});
