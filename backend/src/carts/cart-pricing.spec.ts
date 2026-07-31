import { Prisma } from '@prisma/client';
import { decimalToMinorUnits, minorUnitsJson } from './cart-pricing';
describe('cart pricing', () => {
  it.each([
    ['49.90', 4990n],
    ['0.01', 1n],
    ['10', 1000n],
    ['9999999999.99', 999999999999n],
  ])('converts %s without floating point', (input, expected) =>
    expect(decimalToMinorUnits(new Prisma.Decimal(input))).toBe(expected),
  );
  it('serializes bigint as canonical JSON-safe string', () =>
    expect(JSON.stringify({ amountMinor: minorUnitsJson(4990n) })).toBe('{"amountMinor":"4990"}'));
  it.each(['1.001', '1e2', '-1', 'NaN'])('rejects unsupported money %s', (input) =>
    expect(() => decimalToMinorUnits(input)).toThrow('INVALID_MONEY_DECIMAL'),
  );
});
