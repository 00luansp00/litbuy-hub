import type { ProviderPayment } from '../../payment-provider.port';
import { EfiProviderError } from './efi.errors';
import type { EfiChargeDto } from './efi.types';

const states: Record<string, ProviderPayment['status']> = {
  new: 'PENDING',
  waiting: 'PENDING',
  identified: 'SUCCEEDED',
  paid: 'SUCCEEDED',
  approved: 'SUCCEEDED',
  unpaid: 'FAILED',
  canceled: 'EXPIRED',
  expired: 'EXPIRED',
};

export function mapEfiStatus(value: string): ProviderPayment['status'] {
  const result = states[value.toLowerCase()];
  if (!result) throw new EfiProviderError('INVALID_PROVIDER_RESPONSE', false, true);
  return result;
}

export function mapEfiCharge(value: EfiChargeDto): ProviderPayment {
  if (
    (typeof value.id !== 'string' && typeof value.id !== 'number') ||
    !Number.isSafeInteger(value.total) ||
    value.total < 0
  )
    throw new EfiProviderError('INVALID_PROVIDER_RESPONSE', false, true);
  return {
    id: String(value.id),
    status: mapEfiStatus(value.status),
    money: { amountMinor: BigInt(value.total), currency: 'BRL' },
  };
}
