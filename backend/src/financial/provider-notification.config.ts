import { createSecretKey, type KeyObject } from 'node:crypto';

export type ProviderNotificationIngressConfig = {
  efiBillingEnabled: boolean;
  keyId: string;
  key: KeyObject | null;
};
export const PROVIDER_NOTIFICATION_INGRESS_CONFIG = Symbol('PROVIDER_NOTIFICATION_INGRESS_CONFIG');

export function readProviderNotificationIngressConfig(
  env: NodeJS.ProcessEnv = process.env,
): ProviderNotificationIngressConfig {
  const enabled = env.EFI_BILLING_NOTIFICATION_INGRESS_ENABLED === 'true';
  const keyId = env.PROVIDER_NOTIFICATION_ENCRYPTION_KEY_ID ?? '';
  let key: KeyObject | null = null;
  try {
    const bytes = Buffer.from(env.PROVIDER_NOTIFICATION_ENCRYPTION_KEY_BASE64 ?? '', 'base64');
    if (
      bytes.length === 32 &&
      bytes.toString('base64') === env.PROVIDER_NOTIFICATION_ENCRYPTION_KEY_BASE64
    )
      key = createSecretKey(bytes);
  } catch {
    key = null;
  }
  if (enabled && (!key || !/^[A-Za-z0-9._-]{1,64}$/.test(keyId)))
    throw new Error('Invalid provider notification protection configuration');
  return { efiBillingEnabled: enabled, keyId, key };
}
