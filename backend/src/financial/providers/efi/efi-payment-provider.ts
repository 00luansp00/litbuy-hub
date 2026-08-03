import type { PaymentProviderPort, ProviderPayment } from '../../payment-provider.port';
import type { EfiConfig, EfiChargeEnvelopeDto } from './efi.types';
import { EfiHttpClient, safeObject } from './efi.http-client';
import { amountMinorToSafeNumber, mapEfiCharge } from './efi.mapper';
import { EfiProviderError } from './efi.errors';

export class EfiPaymentProvider implements PaymentProviderPort {
  private readonly client: EfiHttpClient;
  constructor(config: EfiConfig, client?: EfiHttpClient) {
    this.client = client ?? new EfiHttpClient(config.billing);
  }
  async createPayment(input: {
    reference: string;
    money: { amountMinor: bigint; currency: 'BRL' };
    idempotencyHash: string;
  }): Promise<ProviderPayment> {
    const amount = amountMinorToSafeNumber(input.money.amountMinor);
    const response = await this.client.send('POST', '/v1/charge', {
      items: [{ name: input.reference, value: amount, amount: 1 }],
      metadata: { custom_id: input.reference },
    });
    return mapEfiCharge(safeObject(response.body) as unknown as EfiChargeEnvelopeDto);
  }
  async getPayment(id: string): Promise<ProviderPayment | null> {
    try {
      const response = await this.client.send(
        'GET',
        `/v1/charge/${encodeURIComponent(id)}`,
        undefined,
      );
      return mapEfiCharge(safeObject(response.body) as unknown as EfiChargeEnvelopeDto);
    } catch (error) {
      if (error instanceof EfiProviderError && error.code === 'NOT_FOUND') return null;
      throw error;
    }
  }
  async cancelPayment(id: string): Promise<ProviderPayment> {
    await this.client.send('PUT', `/v1/charge/${encodeURIComponent(id)}/cancel`, {});
    const confirmed = await this.getPayment(id);
    if (!confirmed || confirmed.status !== 'EXPIRED')
      throw new EfiProviderError('AMBIGUOUS_RESULT', false, true);
    return confirmed;
  }
  refundPayment(input: {
    paymentId: string;
    money: { amountMinor: bigint; currency: 'BRL' };
    idempotencyHash: string;
  }): Promise<{ id: string; status: 'PENDING' | 'SUCCEEDED' | 'FAILED' }> {
    void input;
    return Promise.reject(new EfiProviderError('UNSUPPORTED_OPERATION', false, false));
  }
}
