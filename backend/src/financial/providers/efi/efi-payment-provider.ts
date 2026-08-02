import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type {
  PaymentProviderPort,
  ProviderPayment,
  ProviderWebhook,
} from '../../payment-provider.port';
import type { EfiConfig, EfiChargeDto, EfiWebhookDto } from './efi.types';
import { EfiHttpClient, safeObject } from './efi.http-client';
import { mapEfiCharge, mapEfiStatus } from './efi.mapper';
import { EfiProviderError } from './efi.errors';

export class EfiPaymentProvider implements PaymentProviderPort {
  constructor(
    private readonly config: EfiConfig,
    private readonly client: EfiHttpClient = new EfiHttpClient(config),
  ) {}
  async createPayment(input: {
    reference: string;
    money: { amountMinor: bigint; currency: 'BRL' };
    idempotencyHash: string;
  }): Promise<ProviderPayment> {
    const response = await this.client.send(
      'POST',
      '/v1/charge',
      { items: [{ name: input.reference, value: Number(input.money.amountMinor), amount: 1 }] },
      input.idempotencyHash,
    );
    return mapEfiCharge(safeObject(response.body) as unknown as EfiChargeDto);
  }
  async getPayment(id: string): Promise<ProviderPayment | null> {
    try {
      const response = await this.client.send(
        'GET',
        `/v1/charge/${encodeURIComponent(id)}`,
        undefined,
      );
      return mapEfiCharge(safeObject(response.body) as unknown as EfiChargeDto);
    } catch (error) {
      if (error instanceof EfiProviderError && error.code === 'NOT_FOUND') return null;
      throw error;
    }
  }
  async cancelPayment(id: string): Promise<ProviderPayment> {
    const response = await this.client.send(
      'PUT',
      `/v1/charge/${encodeURIComponent(id)}/cancel`,
      {},
      `cancel:${id}`,
    );
    return mapEfiCharge(safeObject(response.body) as unknown as EfiChargeDto);
  }
  async refundPayment(input: {
    paymentId: string;
    money: { amountMinor: bigint; currency: 'BRL' };
    idempotencyHash: string;
  }): Promise<{ id: string; status: 'SUCCEEDED' }> {
    const response = await this.client.send(
      'POST',
      `/v1/charge/${encodeURIComponent(input.paymentId)}/refund`,
      { value: Number(input.money.amountMinor) },
      input.idempotencyHash,
    );
    const parsed = safeObject(response.body);
    if (typeof parsed.id !== 'string')
      throw new EfiProviderError('INVALID_PROVIDER_RESPONSE', false, true);
    return { id: parsed.id, status: 'SUCCEEDED' };
  }
  verifyWebhook(payload: Uint8Array, signature: string): Promise<boolean> {
    if (!/^[a-f0-9]{64}$/i.test(signature)) return Promise.resolve(false);
    const expected = createHmac('sha256', this.config.webhookSecret).update(payload).digest();
    return Promise.resolve(timingSafeEqual(expected, Buffer.from(signature, 'hex')));
  }
  parseWebhook(payload: Uint8Array): Promise<ProviderWebhook> {
    try {
      const parsed = safeObject(Buffer.from(payload).toString('utf8')) as unknown as EfiWebhookDto;
      if (
        typeof parsed.id !== 'string' ||
        typeof parsed.type !== 'string' ||
        !['string', 'number'].includes(typeof parsed.charge_id) ||
        typeof parsed.status !== 'string'
      )
        throw new EfiProviderError('INVALID_PROVIDER_RESPONSE', false, false);
      return Promise.resolve({
        externalEventId: parsed.id,
        type: parsed.type,
        paymentId: String(parsed.charge_id),
        status: mapEfiStatus(parsed.status),
        payloadHash: createHash('sha256').update(payload).digest('hex'),
      });
    } catch (error) {
      return Promise.reject(
        error instanceof EfiProviderError
          ? error
          : new EfiProviderError('INVALID_PROVIDER_RESPONSE', false, false),
      );
    }
  }
}
