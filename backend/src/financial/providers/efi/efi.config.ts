import { registerAs } from '@nestjs/config';
import type { EfiConfig, EfiEnvironment } from './efi.types';

const BASE_URLS: Record<EfiEnvironment, string> = {
  sandbox: 'https://cobrancas-h.api.efipay.com.br',
  production: 'https://cobrancas.api.efipay.com.br',
};

export function readEfiConfig(env: NodeJS.ProcessEnv = process.env): EfiConfig {
  const enabled = env.EFI_ENABLED === 'true';
  const environment = (env.EFI_ENVIRONMENT ?? 'sandbox') as EfiEnvironment;
  const config: EfiConfig = {
    enabled,
    environment,
    apiBaseUrl: env.EFI_API_BASE_URL ?? BASE_URLS[environment] ?? '',
    clientId: env.EFI_CLIENT_ID ?? '',
    clientSecret: env.EFI_CLIENT_SECRET ?? '',
    certificate: env.EFI_MTLS_CERTIFICATE ?? '',
    privateKey: env.EFI_MTLS_PRIVATE_KEY ?? '',
    webhookSecret: env.EFI_WEBHOOK_SECRET ?? '',
    timeoutMs: Number(env.EFI_TIMEOUT_MS ?? 8_000),
    productionApproved: env.EFI_PRODUCTION_APPROVED === 'true',
  };
  validateEfiConfig(config);
  return config;
}

export function validateEfiConfig(config: EfiConfig): void {
  if (!config.enabled) return;
  const invalid: string[] = [];
  if (!['sandbox', 'production'].includes(config.environment)) invalid.push('EFI_ENVIRONMENT');
  if (!config.clientId) invalid.push('EFI_CLIENT_ID');
  if (!config.clientSecret) invalid.push('EFI_CLIENT_SECRET');
  if (!config.certificate) invalid.push('EFI_MTLS_CERTIFICATE');
  if (!config.privateKey) invalid.push('EFI_MTLS_PRIVATE_KEY');
  if (!config.webhookSecret) invalid.push('EFI_WEBHOOK_SECRET');
  if (!Number.isInteger(config.timeoutMs) || config.timeoutMs < 1_000 || config.timeoutMs > 30_000)
    invalid.push('EFI_TIMEOUT_MS');
  try {
    const url = new URL(config.apiBaseUrl);
    if (url.protocol !== 'https:') invalid.push('EFI_API_BASE_URL');
  } catch {
    invalid.push('EFI_API_BASE_URL');
  }
  if (config.environment === 'production' && !config.productionApproved)
    invalid.push('EFI_PRODUCTION_APPROVED');
  if (invalid.length)
    throw new Error(`Invalid Efí configuration: ${[...new Set(invalid)].join(', ')}`);
}

export default registerAs('efi', () => readEfiConfig());
