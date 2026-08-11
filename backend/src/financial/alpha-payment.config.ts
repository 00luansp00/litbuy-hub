export type AlphaPaymentConfig = { enabled: boolean };
export const ALPHA_PAYMENT_CONFIG = Symbol('ALPHA_PAYMENT_CONFIG');
export function readAlphaPaymentConfig(env: NodeJS.ProcessEnv = process.env): AlphaPaymentConfig {
  const enabled = env.PAYMENT_PROVIDER_MODE === 'FAKE_ALPHA';
  if (enabled && env.NODE_ENV === 'production')
    throw new Error('FAKE_ALPHA payment provider is forbidden in production');
  return { enabled };
}
