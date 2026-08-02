export type ProviderMoney = { amountMinor: bigint; currency: 'BRL' };
export type ProviderPayment = {
  id: string;
  status: 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'EXPIRED';
  money: ProviderMoney;
};
export type ProviderWebhook = {
  externalEventId: string;
  type: string;
  paymentId: string;
  status: ProviderPayment['status'];
  payloadHash: string;
};
export interface PaymentProviderPort {
  createPayment(input: {
    reference: string;
    money: ProviderMoney;
    idempotencyHash: string;
  }): Promise<ProviderPayment>;
  getPayment(id: string): Promise<ProviderPayment | null>;
  cancelPayment(id: string): Promise<ProviderPayment>;
  refundPayment(input: {
    paymentId: string;
    money: ProviderMoney;
    idempotencyHash: string;
  }): Promise<{ id: string; status: 'SUCCEEDED' }>;
  verifyWebhook(payload: Uint8Array, signature: string): Promise<boolean>;
  parseWebhook(payload: Uint8Array): Promise<ProviderWebhook>;
}
