import { createHash } from 'node:crypto';
import type {
  PaymentProviderNotificationPort,
  ProviderNotificationInput,
  ProviderWebhook,
} from '../../payment-provider.port';
import { EfiProviderError } from './efi.errors';
import { EfiHttpClient, safeObject } from './efi.http-client';
import { mapEfiBillingStatus } from './efi.mapper';
import type { EfiBillingNotificationEnvelopeDto, EfiConfig, EfiPixWebhookDto } from './efi.types';

export class EfiBillingNotificationProvider implements PaymentProviderNotificationPort {
  private readonly client: EfiHttpClient;
  constructor(config: EfiConfig, client?: EfiHttpClient) {
    this.client = client ?? new EfiHttpClient(config.billing);
  }
  async resolveNotification(input: ProviderNotificationInput): Promise<ProviderWebhook[]> {
    if (input.contentType !== 'application/x-www-form-urlencoded') throw invalid();
    const token = parseBillingNotificationToken(input.payload);
    const response = await this.client.send(
      'GET',
      `/v1/notification/${encodeURIComponent(token)}`,
      undefined,
    );
    return mapBillingHistory(
      token,
      safeObject(response.body) as unknown as EfiBillingNotificationEnvelopeDto,
    );
  }
}
export class EfiPixNotificationProvider implements PaymentProviderNotificationPort {
  resolveNotification(input: ProviderNotificationInput): Promise<ProviderWebhook[]> {
    try {
      if (input.contentType !== 'application/json') throw invalid();
      if (!input.transportVerified)
        throw new EfiProviderError('UNVERIFIED_TRANSPORT', false, false);
      const payload = safeObject(
        Buffer.from(input.payload).toString('utf8'),
      ) as unknown as EfiPixWebhookDto;
      if (!Array.isArray(payload.pix) || payload.pix.length === 0) throw invalid();
      return Promise.resolve(
        payload.pix.map((pix) => {
          assertSupportedPixReceived(pix);
          if (
            typeof pix.endToEndId !== 'string' ||
            typeof pix.txid !== 'string' ||
            typeof pix.valor !== 'string' ||
            !/^\d+\.\d{2}$/.test(pix.valor) ||
            typeof pix.horario !== 'string'
          )
            throw invalid();
          return {
            externalEventId: digest(`efi:pix:${pix.endToEndId}`),
            type: 'PIX_RECEIVED',
            paymentId: pix.txid,
            status: 'SUCCEEDED' as const,
            payloadHash: digest(JSON.stringify(pix)),
          };
        }),
      );
    } catch (error) {
      return Promise.reject(error instanceof EfiProviderError ? error : invalid());
    }
  }
}
function assertSupportedPixReceived(pix: EfiPixWebhookDto['pix'][number]): void {
  const value = pix as unknown as Record<string, unknown>;
  const marker = [value.tipo, value.natureza, value.movimento]
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.toUpperCase());
  if (
    Object.hasOwn(value, 'devolucoes') ||
    Object.hasOwn(value, 'devolucao') ||
    Object.hasOwn(value, 'refund') ||
    marker.some((item) =>
      [
        'DEVOLUCAO',
        'DEVOLUÇÃO',
        'REFUND',
        'PIX_ENVIADO',
        'ENVIADO',
        'CASH_OUT',
        'SAIDA',
        'SAÍDA',
      ].includes(item),
    )
  )
    throw new EfiProviderError('UNSUPPORTED_PROVIDER_EVENT', false, true);
}
export function parseBillingNotificationToken(payload: Uint8Array): string {
  const form = new URLSearchParams(Buffer.from(payload).toString('utf8').trim());
  const token = form.get('notification');
  if (form.size !== 1 || !token || !/^[A-Za-z0-9_-]{8,256}$/.test(token)) throw invalid();
  return token;
}
function mapBillingHistory(
  token: string,
  envelope: EfiBillingNotificationEnvelopeDto,
): ProviderWebhook[] {
  if (!Number.isSafeInteger(envelope?.code) || !Array.isArray(envelope?.data)) throw invalid(true);
  return envelope.data
    .filter((event) => event.type === 'charge')
    .map((event) => {
      if (
        !Number.isSafeInteger(event.id) ||
        !Number.isSafeInteger(event.identifiers?.charge_id) ||
        typeof event.status?.current !== 'string' ||
        typeof event.created_at !== 'string'
      )
        throw invalid(true);
      return {
        externalEventId: digest(`efi:billing:${token}:${event.id}`),
        type: 'PAYMENT_STATUS_CHANGED',
        paymentId: String(event.identifiers.charge_id),
        status: mapEfiBillingStatus(event.status.current),
        payloadHash: digest(JSON.stringify(event)),
      };
    });
}
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const invalid = (reconciliation = false) =>
  new EfiProviderError('INVALID_PROVIDER_RESPONSE', false, reconciliation);
