import type { ProviderPayment } from '../../payment-provider.port';
import { EfiProviderError } from './efi.errors';
import type { EfiChargeEnvelopeDto } from './efi.types';

const states: Record<string, ProviderPayment['status']> = {
  new: 'PENDING',
  waiting: 'PENDING',
  identified: 'PENDING',
  approved: 'PENDING',
  link: 'PENDING',
  paid: 'SUCCEEDED',
  unpaid: 'FAILED',
  canceled: 'EXPIRED',
  expired: 'EXPIRED',
};
const semanticEvents = new Set(['refunded', 'contested', 'settled']);

export function mapEfiBillingStatus(value: string): ProviderPayment['status'] {
  const normalized = value.toLowerCase();
  const result = states[normalized];
  if (result) return result;
  throw new EfiProviderError('INVALID_PROVIDER_RESPONSE', false, semanticEvents.has(normalized));
}
export function mapEfiCharge(envelope: EfiChargeEnvelopeDto): ProviderPayment {
  const value = envelope?.data;
  if (
    !Number.isSafeInteger(envelope?.code) ||
    !value ||
    !Number.isSafeInteger(value.charge_id) ||
    !Number.isSafeInteger(value.total) ||
    value.total < 0 ||
    typeof value.status !== 'string'
  )
    throw new EfiProviderError('INVALID_PROVIDER_RESPONSE', false, true);
  return {
    id: String(value.charge_id),
    status: mapEfiBillingStatus(value.status),
    money: { amountMinor: BigInt(value.total), currency: 'BRL' },
  };
}
export function amountMinorToSafeNumber(value: bigint): number {
  if (value <= 0n || value > BigInt(Number.MAX_SAFE_INTEGER))
    throw new EfiProviderError('INVALID_REQUEST', false, false);
  const result = Number(value);
  if (!Number.isSafeInteger(result) || BigInt(result) !== value)
    throw new EfiProviderError('INVALID_REQUEST', false, false);
  return result;
}
