import { createSecretKey } from 'node:crypto';
import { ServiceUnavailableException } from '@nestjs/common';
import { ProviderNotificationProtector } from './provider-notification-protector';
import { readProviderNotificationIngressConfig } from './provider-notification.config';
import { ProviderNotificationIngressService } from './provider-notification-ingress.service';

describe('provider notification protection and ingress', () => {
  const token = 'notification_token_123';
  const config = {
    efiBillingEnabled: true,
    keyId: 'notification-key-2026-08',
    key: createSecretKey(Buffer.alloc(32, 7)),
  };

  it('encrypts recoverably with authenticated, versioned material and no plaintext', () => {
    const protector = new ProviderNotificationProtector(config);
    const protectedValue = protector.protect(token);
    expect(protectedValue.payloadHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(protectedValue)).not.toContain(token);
    expect(protector.recover(protectedValue)).toBe(token);
    const tampered = {
      ...protectedValue,
      protectedCiphertext: Buffer.from(protectedValue.protectedCiphertext),
    };
    tampered.protectedCiphertext[0] ^= 1;
    expect(() => protector.recover(tampered)).toThrow();
  });

  it('fails closed on an enabled ingress with missing or malformed key material', () => {
    expect(() =>
      readProviderNotificationIngressConfig({
        EFI_BILLING_NOTIFICATION_INGRESS_ENABLED: 'true',
      }),
    ).toThrow('Invalid provider notification protection configuration');
  });

  it('persists each valid delivery independently and never invokes a provider', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'inbox-id' });
    const service = new ProviderNotificationIngressService(
      { providerNotificationInbox: { create } } as never,
      new ProviderNotificationProtector(config),
      config,
    );
    await service.acceptEfiBilling(token);
    await service.acceptEfiBilling(token);
    expect(create).toHaveBeenCalledTimes(2);
    const calls = create.mock.calls as Array<
      [{ data: { payloadHash: string; protectedCiphertext: Uint8Array } }]
    >;
    for (const call of calls) {
      const persisted = call[0].data;
      expect(JSON.stringify(persisted)).not.toContain(token);
      expect(persisted.payloadHash).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it('disabled ingress persists nothing', async () => {
    const create = jest.fn();
    const disabled = { ...config, efiBillingEnabled: false };
    const service = new ProviderNotificationIngressService(
      { providerNotificationInbox: { create } } as never,
      new ProviderNotificationProtector(disabled),
      disabled,
    );
    await expect(service.acceptEfiBilling(token)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(create).not.toHaveBeenCalled();
  });
});
