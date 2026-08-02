import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PaymentProviderPort } from '../../payment-provider.port';
import { readEfiConfig } from './efi.config';
import { EfiProviderError, mapEfiHttpError } from './efi.errors';
import { EfiHttpClient } from './efi.http-client';
import { mapEfiStatus } from './efi.mapper';
import { EfiPaymentProvider } from './efi-payment-provider';
import type { EfiConfig, EfiHttpRequest, EfiHttpTransport } from './efi.types';

const fixture = (name: string) => readFileSync(join(__dirname, 'fixtures', name));
const config = (overrides: Partial<EfiConfig> = {}): EfiConfig => ({
  enabled: true,
  environment: 'sandbox',
  apiBaseUrl: 'https://sandbox.invalid',
  clientId: 'client-not-logged',
  clientSecret: 'secret-not-logged',
  certificate: 'certificate-not-logged',
  privateKey: 'key-not-logged',
  webhookSecret: 'webhook-not-logged',
  timeoutMs: 1000,
  productionApproved: false,
  ...overrides,
});

describe('Efí configuration boundary', () => {
  it('does not require secrets while disabled and separates sandbox from production', () => {
    const sandbox = readEfiConfig({ EFI_ENABLED: 'false' });
    const production = readEfiConfig({ EFI_ENABLED: 'false', EFI_ENVIRONMENT: 'production' });
    expect(sandbox.enabled).toBe(false);
    expect(sandbox.environment).toBe('sandbox');
    expect(sandbox.apiBaseUrl).toContain('-h.api.');
    expect(production.environment).toBe('production');
    expect(production.apiBaseUrl).not.toContain('-h.api.');
  });
  it('fails startup validation without secrets, mTLS, or explicit production approval', () => {
    expect(() => readEfiConfig({ EFI_ENABLED: 'true' })).toThrow(
      /EFI_CLIENT_SECRET.*EFI_MTLS_CERTIFICATE/,
    );
    expect(() =>
      readEfiConfig({
        EFI_ENABLED: 'true',
        EFI_ENVIRONMENT: 'production',
        EFI_CLIENT_ID: 'id',
        EFI_CLIENT_SECRET: 'secret',
        EFI_MTLS_CERTIFICATE: 'cert',
        EFI_MTLS_PRIVATE_KEY: 'key',
        EFI_WEBHOOK_SECRET: 'hook',
      }),
    ).toThrow(/EFI_PRODUCTION_APPROVED/);
  });
  it('rejects unsafe URLs and invalid timeouts', () => {
    expect(() =>
      readEfiConfig({
        EFI_ENABLED: 'true',
        EFI_CLIENT_ID: 'id',
        EFI_CLIENT_SECRET: 'secret',
        EFI_MTLS_CERTIFICATE: 'cert',
        EFI_MTLS_PRIVATE_KEY: 'key',
        EFI_WEBHOOK_SECRET: 'hook',
        EFI_API_BASE_URL: 'http://unsafe',
        EFI_TIMEOUT_MS: '0',
      }),
    ).toThrow(/EFI_TIMEOUT_MS.*EFI_API_BASE_URL/);
  });
});

describe('Efí HTTP and authentication', () => {
  it('authenticates with mTLS and carries correlation and idempotency IDs', async () => {
    const requests: EfiHttpRequest[] = [];
    const transport: EfiHttpTransport = (request) => {
      requests.push(request);
      return Promise.resolve(
        request.url.pathname === '/v1/authorize'
          ? {
              status: 200,
              headers: {},
              body: '{"access_token":"token-not-logged","expires_in":300}',
            }
          : { status: 200, headers: {}, body: fixture('payment-paid.json').toString() },
      );
    };
    const client = new EfiHttpClient(config(), transport);
    await client.send('POST', '/v1/charge', {}, 'idempotency');
    expect(requests[0]).toMatchObject({
      certificate: 'certificate-not-logged',
      privateKey: 'key-not-logged',
      timeoutMs: 1000,
    });
    expect(requests[0].headers.authorization).toMatch(/^Basic /);
    expect(requests[1].headers.authorization).toBe('Bearer token-not-logged');
    expect(requests[1].headers['x-idempotency-key']).toBe('idempotency');
    expect(typeof requests[1].headers['x-correlation-id']).toBe('string');
  });
  it('normalizes timeout and ambiguous mutation results into reconciliation', async () => {
    const failing = (message: string) =>
      new EfiHttpClient(config(), () => Promise.reject(new Error(message)));
    await expect(failing('EFI_TIMEOUT').send('POST', '/charge', {})).rejects.toMatchObject({
      code: 'TIMEOUT',
      requiresReconciliation: true,
    });
    await expect(failing('socket reset').send('POST', '/charge', {})).rejects.toMatchObject({
      code: 'AMBIGUOUS_RESULT',
      requiresReconciliation: true,
    });
  });
  it('normalizes provider errors without response bodies or secrets', () => {
    expect(mapEfiHttpError(401)).toMatchObject({ code: 'AUTHENTICATION_FAILED', retryable: false });
    expect(mapEfiHttpError(429)).toMatchObject({ code: 'RATE_LIMITED', retryable: true });
    expect(mapEfiHttpError(503)).toMatchObject({
      code: 'PROVIDER_UNAVAILABLE',
      requiresReconciliation: true,
    });
    for (const error of [mapEfiHttpError(401), new EfiProviderError('TIMEOUT', false, true)]) {
      expect(error.message).not.toMatch(/secret-not-logged|certificate-not-logged|key-not-logged/);
    }
  });
});

describe('Efí mapping and webhooks', () => {
  it.each([
    ['new', 'PENDING'],
    ['paid', 'SUCCEEDED'],
    ['unpaid', 'FAILED'],
    ['expired', 'EXPIRED'],
  ] as const)('maps %s', (source, target) => expect(mapEfiStatus(source)).toBe(target));
  it('rejects unknown states and malformed payloads', async () => {
    expect(() => mapEfiStatus('future-state')).toThrow(EfiProviderError);
    const provider = new EfiPaymentProvider(config());
    await expect(provider.parseWebhook(Buffer.from('{}'))).rejects.toBeInstanceOf(EfiProviderError);
    await expect(provider.parseWebhook(Buffer.from('{'))).rejects.toBeInstanceOf(EfiProviderError);
  });
  it('verifies, parses, and deterministically identifies duplicate events', async () => {
    const payload = fixture('webhook-paid.json');
    const provider = new EfiPaymentProvider(config());
    const signature = createHmac('sha256', config().webhookSecret).update(payload).digest('hex');
    expect(await provider.verifyWebhook(payload, signature)).toBe(true);
    expect(await provider.verifyWebhook(payload, 'invalid')).toBe(false);
    const first = await provider.parseWebhook(payload);
    const duplicate = await provider.parseWebhook(payload);
    expect(first).toEqual(duplicate);
    expect(first.externalEventId).toBe('evt_123');
    expect(first.paymentId).toBe('charge_123');
    expect(first.status).toBe('SUCCEEDED');
    expect(first.payloadHash).toMatch(/^[a-f0-9]{64}$/);
  });
  it('implements the provider-agnostic port without exporting Efí DTOs', () => {
    const value: PaymentProviderPort = new EfiPaymentProvider(config());
    expect(value).toBeInstanceOf(EfiPaymentProvider);
  });
});
