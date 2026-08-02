import { createHash } from 'node:crypto';
import type {
  PaymentProviderPort,
  ProviderPayment,
  ProviderWebhook,
} from './payment-provider.port';
export class FakePaymentProvider implements PaymentProviderPort {
  private sequence = 0;
  private readonly payments = new Map<string, ProviderPayment>();
  private readonly keyed = new Map<string, ProviderPayment>();
  createPayment(input: {
    reference: string;
    money: { amountMinor: bigint; currency: 'BRL' };
    idempotencyHash: string;
  }) {
    const prior = this.keyed.get(input.idempotencyHash);
    if (prior) return Promise.resolve(prior);
    const value: ProviderPayment = {
      id: `fake_payment_${++this.sequence}`,
      status: 'PENDING',
      money: input.money,
    };
    this.payments.set(value.id, value);
    this.keyed.set(input.idempotencyHash, value);
    return Promise.resolve(value);
  }
  getPayment(id: string) {
    return Promise.resolve(this.payments.get(id) ?? null);
  }
  simulate(id: string, status: ProviderPayment['status']) {
    const prior = this.payments.get(id);
    if (!prior) throw new Error('FAKE_PAYMENT_NOT_FOUND');
    const next = { ...prior, status };
    this.payments.set(id, next);
    return next;
  }
  cancelPayment(id: string) {
    return Promise.resolve(this.simulate(id, 'EXPIRED'));
  }
  refundPayment(input: {
    paymentId: string;
    money: { amountMinor: bigint; currency: 'BRL' };
    idempotencyHash: string;
  }) {
    if (!this.payments.has(input.paymentId)) throw new Error('FAKE_PAYMENT_NOT_FOUND');
    return Promise.resolve({
      id: `fake_refund_${input.idempotencyHash}`,
      status: 'SUCCEEDED' as const,
    });
  }
  verifyWebhook(_payload: Uint8Array, signature: string) {
    return Promise.resolve(signature === 'fake-valid-signature');
  }
  parseWebhook(payload: Uint8Array): Promise<ProviderWebhook> {
    const parsed = JSON.parse(Buffer.from(payload).toString()) as Omit<
      ProviderWebhook,
      'payloadHash'
    >;
    return Promise.resolve({
      ...parsed,
      payloadHash: createHash('sha256').update(payload).digest('hex'),
    });
  }
}
