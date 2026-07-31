import type { Prisma } from '@prisma/client';

/** Converts a scale-2 catalog Decimal to minor units without binary floating point. */
export function decimalToMinorUnits(
  value: Prisma.Decimal | { toString(): string } | string,
): bigint {
  const text = typeof value === 'string' ? value : value.toString();
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) throw new Error('INVALID_MONEY_DECIMAL');
  return BigInt(match[1]) * 100n + BigInt((match[2] ?? '').padEnd(2, '0'));
}

export const minorUnitsJson = (amount: bigint) => amount.toString(10);
