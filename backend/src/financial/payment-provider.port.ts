export type ProviderMoney = { amountMinor: bigint; currency: 'BRL' };
export type ProviderFailureKind = 'DEFINITIVE' | 'SAFE_TO_RETRY' | 'AMBIGUOUS';
/** Provider-neutral failure exposed to application services. */
export class PaymentProviderError extends Error {
  constructor(
    public readonly kind: ProviderFailureKind,
    public readonly reason: string = 'PAYMENT_PROVIDER_FAILURE',
  ) {
    super(reason);
    this.name = 'PaymentProviderError';
  }
  get requiresReconciliation() {
    return this.kind === 'AMBIGUOUS';
  }
}
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
export type ProviderNotificationInput = {
  payload: Uint8Array;
  contentType: 'application/x-www-form-urlencoded' | 'application/json';
  transportVerified: boolean;
};
export interface PaymentProviderPort {
  /** Stable persistence identity supplied by the adapter, not by orchestration logic. */
  readonly providerCode: string;
  /** Fails locally before persistence or network access when the adapter is unavailable. */
  assertAvailable(): void;
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
  }): Promise<{ id: string; status: 'PENDING' | 'SUCCEEDED' | 'FAILED' }>;
}
export interface PaymentProviderNotificationPort {
  resolveNotification(input: ProviderNotificationInput): Promise<ProviderWebhook[]>;
}
