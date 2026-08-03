import {
  PaymentProviderError,
  type PaymentProviderPort,
  type ProviderPayment,
} from '../../payment-provider.port';
import type { EfiConfig, EfiChargeEnvelopeDto } from './efi.types';
import { validateEfiConfig } from './efi.config';
import { EfiHttpClient, safeObject } from './efi.http-client';
import { amountMinorToSafeNumber, mapEfiCharge } from './efi.mapper';
import { EfiProviderError } from './efi.errors';

export class EfiPaymentProvider implements PaymentProviderPort {
  readonly providerCode = 'EFI_BILLING';
  private readonly client: EfiHttpClient;
  constructor(
    private readonly config: EfiConfig,
    client?: EfiHttpClient,
  ) {
    validateEfiConfig(config);
    this.client = client ?? new EfiHttpClient(config.billing);
  }
  assertAvailable(): void {
    if (!this.config.enabled) throw new PaymentProviderError('DEFINITIVE', 'PROVIDER_DISABLED');
    if (this.config.environment === 'production' && !this.config.productionApproved)
      throw new PaymentProviderError('DEFINITIVE', 'PROVIDER_PRODUCTION_NOT_APPROVED');
  }
  async createPayment(input: {
    reference: string;
    money: { amountMinor: bigint; currency: 'BRL' };
    idempotencyHash: string;
  }): Promise<ProviderPayment> {
    this.assertAvailable();
    try {
      const amount = amountMinorToSafeNumber(input.money.amountMinor);
      const response = await this.client.send('POST', '/v1/charge', {
        items: [{ name: input.reference, value: amount, amount: 1 }],
        metadata: { custom_id: input.reference },
      });
      return mapEfiCharge(safeObject(response.body) as unknown as EfiChargeEnvelopeDto);
    } catch (error) {
      throw this.providerError(error);
    }
  }
  async getPayment(id: string): Promise<ProviderPayment | null> {
    this.assertAvailable();
    try {
      const response = await this.client.send(
        'GET',
        `/v1/charge/${encodeURIComponent(id)}`,
        undefined,
      );
      return mapEfiCharge(safeObject(response.body) as unknown as EfiChargeEnvelopeDto);
    } catch (error) {
      if (error instanceof EfiProviderError && error.code === 'NOT_FOUND') return null;
      throw this.providerError(error);
    }
  }
  async cancelPayment(id: string): Promise<ProviderPayment> {
    this.assertAvailable();
    try {
      await this.client.send('PUT', `/v1/charge/${encodeURIComponent(id)}/cancel`, {});
      const confirmed = await this.getPayment(id);
      if (!confirmed || confirmed.status !== 'EXPIRED')
        throw new EfiProviderError('AMBIGUOUS_RESULT', false, true);
      return confirmed;
    } catch (error) {
      throw this.providerError(error);
    }
  }
  refundPayment(input: {
    paymentId: string;
    money: { amountMinor: bigint; currency: 'BRL' };
    idempotencyHash: string;
  }): Promise<{ id: string; status: 'PENDING' | 'SUCCEEDED' | 'FAILED' }> {
    void input;
    this.assertAvailable();
    return Promise.reject(new PaymentProviderError('DEFINITIVE', 'UNSUPPORTED_OPERATION'));
  }
  private providerError(error: unknown): PaymentProviderError {
    if (error instanceof PaymentProviderError) return error;
    if (!(error instanceof EfiProviderError)) return new PaymentProviderError('AMBIGUOUS');
    if (error.requiresReconciliation) return new PaymentProviderError('AMBIGUOUS', error.code);
    if (error.retryable) return new PaymentProviderError('SAFE_TO_RETRY', error.code);
    return new PaymentProviderError('DEFINITIVE', error.code);
  }
}
