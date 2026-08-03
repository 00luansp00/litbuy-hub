import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type {
  PaymentProviderNotificationPort,
  PaymentProviderPort,
} from '../../payment-provider.port';
import { readEfiConfig } from './efi.config';
import { EfiProviderError, mapEfiHttpError } from './efi.errors';
import { EfiHttpClient } from './efi.http-client';
import { mapEfiBillingStatus } from './efi.mapper';
import {
  EfiBillingNotificationProvider,
  EfiPixNotificationProvider,
  parseBillingNotificationToken,
} from './efi-notification-provider';
import { EfiPaymentProvider } from './efi-payment-provider';
import type { EfiConfig, EfiHttpRequest, EfiHttpResponse, EfiHttpTransport } from './efi.types';

const fixture = (name: string) => readFileSync(join(__dirname, 'fixtures', name));
const enabledEnv = {
  NODE_ENV: 'test',
  EFI_ENABLED: 'true',
  EFI_CLIENT_ID: 'client-not-logged',
  EFI_CLIENT_SECRET: 'secret-not-logged',
  EFI_PIX_MTLS_CERTIFICATE: 'certificate-not-logged',
  EFI_PIX_MTLS_PRIVATE_KEY: 'key-not-logged',
};
const config = (overrides: NodeJS.ProcessEnv = {}): EfiConfig =>
  readEfiConfig({ ...enabledEnv, ...overrides });
const response = (body: Buffer | string, status = 200): EfiHttpResponse => ({
  status,
  headers: {},
  body: body.toString(),
});
function queuedTransport(bodies: Array<EfiHttpResponse | Error>) {
  const requests: EfiHttpRequest[] = [];
  const transport: EfiHttpTransport = (request) => {
    requests.push(request);
    const value = bodies.shift();
    return value instanceof Error
      ? Promise.reject(value)
      : value
        ? Promise.resolve(value)
        : Promise.reject(new Error('unexpected request'));
  };
  return { requests, transport };
}
const auth = response('{"access_token":"access-not-logged","expires_in":300}');

describe('Efí configuration profiles', () => {
  it('pins distinct Billing/Pix hosts and OAuth paths', () => {
    const value = config();
    expect(value.billing.baseUrl).toBe('https://cobrancas-h.api.efipay.com.br');
    expect(value.billing.oauthPath).toBe('/v1/authorize');
    expect(value.billing.certificate).toBeUndefined();
    expect(value.pix.baseUrl).toBe('https://pix-h.api.efipay.com.br');
    expect(value.pix.oauthPath).toBe('/oauth/token');
    expect(value.pix.certificate).toBe('certificate-not-logged');
  });
  it('requires secrets and Pix mTLS when enabled', () => {
    expect(() => readEfiConfig({ NODE_ENV: 'test', EFI_ENABLED: 'true' })).toThrow(
      /EFI_CLIENT_SECRET.*EFI_PIX_MTLS_CERTIFICATE/,
    );
  });
  it('rejects arbitrary production hosts even when HTTPS', () => {
    expect(() =>
      config({
        NODE_ENV: 'production',
        EFI_ENVIRONMENT: 'production',
        EFI_PRODUCTION_APPROVED: 'true',
        EFI_BILLING_API_BASE_URL: 'https://attacker.invalid',
      }),
    ).toThrow(/EFI_BILLING_API_BASE_URL/);
  });
  it.each([
    ['arbitrary port', { EFI_BILLING_API_BASE_URL: 'https://cobrancas.api.efipay.com.br:444' }],
    ['credentials', { EFI_BILLING_API_BASE_URL: 'https://user:pass@cobrancas.api.efipay.com.br' }],
    ['query', { EFI_BILLING_API_BASE_URL: 'https://cobrancas.api.efipay.com.br?target=other' }],
    ['fragment', { EFI_BILLING_API_BASE_URL: 'https://cobrancas.api.efipay.com.br#other' }],
    ['http', { EFI_BILLING_API_BASE_URL: 'http://cobrancas.api.efipay.com.br' }],
    ['sandbox host', { EFI_BILLING_API_BASE_URL: 'https://cobrancas-h.api.efipay.com.br' }],
    ['wrong profile', { EFI_BILLING_API_BASE_URL: 'https://pix.api.efipay.com.br' }],
  ])('rejects production Billing URL with %s', (_name, override) => {
    expect(() =>
      config({
        NODE_ENV: 'production',
        EFI_ENVIRONMENT: 'production',
        EFI_PRODUCTION_APPROVED: 'true',
        ...override,
      }),
    ).toThrow(/EFI_BILLING_API_BASE_URL/);
  });
  it('allows explicit test-only overrides but rejects invalid timeout', () => {
    expect(config({ EFI_BILLING_API_BASE_URL: 'https://mock.invalid' }).billing.baseUrl).toBe(
      'https://mock.invalid',
    );
    expect(() => config({ EFI_TIMEOUT_MS: '0' })).toThrow(/EFI_TIMEOUT_MS/);
  });
});

describe('Efí Billing charges', () => {
  it('maps the official create envelope and sends metadata custom_id without undocumented idempotency header', async () => {
    const queue = queuedTransport([auth, response(fixture('charge-created.json'))]);
    const provider = new EfiPaymentProvider(
      config(),
      new EfiHttpClient(config().billing, queue.transport),
    );
    await expect(
      provider.createPayment({
        reference: 'order-123',
        money: { amountMinor: 12990n, currency: 'BRL' },
        idempotencyHash: 'internal-only',
      }),
    ).resolves.toEqual({
      id: '1234567',
      status: 'PENDING',
      money: { amountMinor: 12990n, currency: 'BRL' },
    });
    expect(queue.requests[1].headers['x-idempotency-key']).toBeUndefined();
    expect(JSON.parse(queue.requests[1].body ?? '{}')).toMatchObject({
      metadata: { custom_id: 'order-123' },
    });
  });
  it('maps the official get envelope', async () => {
    const queue = queuedTransport([auth, response(fixture('charge-detail.json'))]);
    const provider = new EfiPaymentProvider(
      config(),
      new EfiHttpClient(config().billing, queue.transport),
    );
    await expect(provider.getPayment('1234567')).resolves.toMatchObject({
      id: '1234567',
      status: 'SUCCEEDED',
    });
    expect(queue.requests[1].url.pathname).toBe('/v1/charge/1234567');
  });
  it('cancels then confirms with read-after-write instead of mapping cancel response', async () => {
    const queue = queuedTransport([
      auth,
      response(fixture('charge-cancel.json')),
      response('{"code":200,"data":{"charge_id":1234567,"status":"canceled","total":12990}}'),
    ]);
    const provider = new EfiPaymentProvider(
      config(),
      new EfiHttpClient(config().billing, queue.transport),
    );
    await expect(provider.cancelPayment('1234567')).resolves.toMatchObject({ status: 'EXPIRED' });
    expect(
      queue.requests.slice(1).map((request) => `${request.method} ${request.url.pathname}`),
    ).toEqual(['PUT /v1/charge/1234567/cancel', 'GET /v1/charge/1234567']);
  });
  it('reconciles rather than trusting a boleto reported paid after cancellation', async () => {
    const queue = queuedTransport([
      auth,
      response(fixture('charge-cancel.json')),
      response(fixture('charge-detail.json')),
    ]);
    const provider = new EfiPaymentProvider(
      config(),
      new EfiHttpClient(config().billing, queue.transport),
    );
    await expect(provider.cancelPayment('1234567')).rejects.toMatchObject({
      code: 'AMBIGUOUS_RESULT',
      requiresReconciliation: true,
    });
  });
  it('rejects unsafe money before network access', async () => {
    const queue = queuedTransport([]);
    const provider = new EfiPaymentProvider(
      config(),
      new EfiHttpClient(config().billing, queue.transport),
    );
    await expect(
      provider.createPayment({
        reference: 'order',
        money: { amountMinor: BigInt(Number.MAX_SAFE_INTEGER) + 1n, currency: 'BRL' },
        idempotencyHash: 'x',
      }),
    ).rejects.toMatchObject({ kind: 'DEFINITIVE', reason: 'INVALID_REQUEST' });
    expect(queue.requests).toHaveLength(0);
  });
  it('does not retry an ambiguous create mutation', async () => {
    const queue = queuedTransport([auth, new Error('socket reset')]);
    const provider = new EfiPaymentProvider(
      config(),
      new EfiHttpClient(config().billing, queue.transport),
    );
    await expect(
      provider.createPayment({
        reference: 'order',
        money: { amountMinor: 100n, currency: 'BRL' },
        idempotencyHash: 'x',
      }),
    ).rejects.toMatchObject({
      kind: 'AMBIGUOUS',
      reason: 'AMBIGUOUS_RESULT',
      requiresReconciliation: true,
    });
    expect(queue.requests.filter((request) => request.url.pathname === '/v1/charge')).toHaveLength(
      1,
    );
  });
  it('rejects generic refunds without network access', async () => {
    const queue = queuedTransport([]);
    const provider = new EfiPaymentProvider(
      config(),
      new EfiHttpClient(config().billing, queue.transport),
    );
    await expect(
      provider.refundPayment({
        paymentId: '1',
        money: { amountMinor: 100n, currency: 'BRL' },
        idempotencyHash: 'x',
      }),
    ).rejects.toMatchObject({ code: 'UNSUPPORTED_OPERATION' });
    expect(queue.requests).toHaveLength(0);
  });
});

describe('Efí Billing statuses', () => {
  it.each([
    ['new', 'PENDING'],
    ['waiting', 'PENDING'],
    ['identified', 'PENDING'],
    ['approved', 'PENDING'],
    ['link', 'PENDING'],
    ['paid', 'SUCCEEDED'],
    ['unpaid', 'FAILED'],
    ['canceled', 'EXPIRED'],
    ['expired', 'EXPIRED'],
  ] as const)('maps %s to %s', (source, target) =>
    expect(mapEfiBillingStatus(source)).toBe(target),
  );
  it.each(['refunded', 'contested', 'settled'])(
    'requires reconciliation for semantic state %s',
    (status) => {
      try {
        mapEfiBillingStatus(status);
        fail('expected');
      } catch (error) {
        expect(error).toMatchObject({
          code: 'INVALID_PROVIDER_RESPONSE',
          requiresReconciliation: true,
        });
      }
    },
  );
});

describe('Efí HTTP retry classification', () => {
  it.each([
    ['GET timeout', 'GET', new Error('EFI_TIMEOUT'), 'TIMEOUT'],
    ['GET transport failure', 'GET', new Error('socket reset'), 'PROVIDER_UNAVAILABLE'],
  ] as const)('%s is safe to retry', async (_name, method, failure, code) => {
    const queue = queuedTransport([auth, failure]);
    const client = new EfiHttpClient(config().billing, queue.transport);
    await expect(client.send(method, '/v1/charge/1', undefined)).rejects.toMatchObject({
      code,
      retryable: true,
      requiresReconciliation: false,
    });
    expect(
      queue.requests.filter((request) => request.url.pathname === '/v1/charge/1'),
    ).toHaveLength(1);
  });
  it.each([
    ['POST socket reset', 'POST', new Error('socket reset')],
    ['POST timeout', 'POST', new Error('EFI_TIMEOUT')],
    ['PUT socket reset', 'PUT', new Error('socket reset')],
    ['PUT timeout', 'PUT', new Error('EFI_TIMEOUT')],
  ] as const)('%s is never blindly retried', async (_name, method, failure) => {
    const queue = queuedTransport([auth, failure]);
    const client = new EfiHttpClient(config().billing, queue.transport);
    await expect(client.send(method, '/v1/mutation', {})).rejects.toMatchObject({
      code: 'AMBIGUOUS_RESULT',
      retryable: false,
      requiresReconciliation: true,
    });
    expect(
      queue.requests.filter((request) => request.url.pathname === '/v1/mutation'),
    ).toHaveLength(1);
  });
  it('does not mark mutation 429/5xx as retryable without an execution guarantee', () => {
    expect(mapEfiHttpError(429, 'POST')).toMatchObject({
      retryable: false,
      requiresReconciliation: true,
    });
    expect(mapEfiHttpError(503, 'PUT')).toMatchObject({
      retryable: false,
      requiresReconciliation: true,
    });
    expect(mapEfiHttpError(503, 'GET')).toMatchObject({
      retryable: true,
      requiresReconciliation: false,
    });
  });
});

describe('Efí Billing notification resolution', () => {
  it('parses the real form callback and resolves authenticated history', async () => {
    const callback = fixture('billing-notification-callback.txt');
    expect(parseBillingNotificationToken(callback)).toBe('notification_token_123456789');
    const queue = queuedTransport([auth, response(fixture('billing-notification-history.json'))]);
    const provider = new EfiBillingNotificationProvider(
      config(),
      new EfiHttpClient(config().billing, queue.transport),
    );
    const events = await provider.resolveNotification({
      payload: callback,
      contentType: 'application/x-www-form-urlencoded',
      transportVerified: true,
    });
    expect(queue.requests[1].url.pathname).toBe('/v1/notification/notification_token_123456789');
    expect(events.map((event) => event.status)).toEqual(['PENDING', 'SUCCEEDED']);
    expect(events[0].externalEventId).not.toBe(events[1].externalEventId);
  });
  it('gives a repeated history event the same external ID', async () => {
    const callback = fixture('billing-notification-callback.txt');
    const history = response(fixture('billing-notification-history.json'));
    const queue = queuedTransport([auth, history, history]);
    const provider = new EfiBillingNotificationProvider(
      config(),
      new EfiHttpClient(config().billing, queue.transport),
    );
    const input = {
      payload: callback,
      contentType: 'application/x-www-form-urlencoded' as const,
      transportVerified: true,
    };
    const first = await provider.resolveNotification(input);
    const repeated = await provider.resolveNotification(input);
    expect(first[1].externalEventId).toBe(repeated[1].externalEventId);
  });
  it('rejects malformed callbacks', () =>
    expect(() => parseBillingNotificationToken(Buffer.from('notification=x&extra=y'))).toThrow(
      EfiProviderError,
    ));
});

describe('Efí Pix notification boundary', () => {
  it('maps only a pure received Pix after trusted-ingress verification', async () => {
    const provider: PaymentProviderNotificationPort = new EfiPixNotificationProvider();
    const payload = fixture('pix-webhook.json');
    await expect(
      provider.resolveNotification({
        payload,
        contentType: 'application/json',
        transportVerified: false,
      }),
    ).rejects.toMatchObject({ code: 'UNVERIFIED_TRANSPORT' });
    await expect(
      provider.resolveNotification({
        payload,
        contentType: 'application/json',
        transportVerified: true,
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        type: 'PIX_RECEIVED',
        paymentId: 'order123pix',
        status: 'SUCCEEDED',
      }),
    ]);
  });
  it.each([
    ['Pix refund', 'pix-refund-webhook.json'],
    ['outbound Pix/cash-out', 'pix-outbound-webhook.json'],
  ])('%s never becomes PIX_RECEIVED and requires reconciliation', async (_name, filename) => {
    const provider = new EfiPixNotificationProvider();
    await expect(
      provider.resolveNotification({
        payload: fixture(filename),
        contentType: 'application/json',
        transportVerified: true,
      }),
    ).rejects.toMatchObject({
      code: 'UNSUPPORTED_PROVIDER_EVENT',
      retryable: false,
      requiresReconciliation: true,
    });
  });
  it('rejects malformed Pix payloads fail-closed', async () => {
    const provider = new EfiPixNotificationProvider();
    await expect(
      provider.resolveNotification({
        payload: Buffer.from('{"pix":[{"txid":"missing-fields"}]}'),
        contentType: 'application/json',
        transportVerified: true,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_PROVIDER_RESPONSE' });
  });
  it('rejects unverified transport before unsupported-event classification', async () => {
    const provider = new EfiPixNotificationProvider();
    await expect(
      provider.resolveNotification({
        payload: fixture('pix-refund-webhook.json'),
        contentType: 'application/json',
        transportVerified: false,
      }),
    ).rejects.toMatchObject({ code: 'UNVERIFIED_TRANSPORT', requiresReconciliation: false });
  });
  it('keeps payment operations and notification resolution provider-neutral', () => {
    const payment: PaymentProviderPort = new EfiPaymentProvider(config());
    const notification: PaymentProviderNotificationPort = new EfiBillingNotificationProvider(
      config(),
    );
    expect(payment).toBeInstanceOf(EfiPaymentProvider);
    expect(notification).toBeInstanceOf(EfiBillingNotificationProvider);
  });
  it('normalizes errors without secret, token, or certificate values', () => {
    const error = mapEfiHttpError(503, 'GET');
    expect(error.message).not.toMatch(
      /secret-not-logged|notification_token|certificate-not-logged/,
    );
  });
});
