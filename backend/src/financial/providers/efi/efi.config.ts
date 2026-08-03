import { registerAs } from '@nestjs/config';
import type { EfiApiKind, EfiApiProfile, EfiConfig, EfiEnvironment } from './efi.types';

const HOSTS: Record<EfiEnvironment, Record<EfiApiKind, string>> = {
  sandbox: { billing: 'cobrancas-h.api.efipay.com.br', pix: 'pix-h.api.efipay.com.br' },
  production: { billing: 'cobrancas.api.efipay.com.br', pix: 'pix.api.efipay.com.br' },
};
const urls = (environment: EfiEnvironment, kind: EfiApiKind) =>
  `https://${HOSTS[environment][kind]}`;

export function readEfiConfig(env: NodeJS.ProcessEnv = process.env): EfiConfig {
  const environment = (env.EFI_ENVIRONMENT ?? 'sandbox') as EfiEnvironment;
  const timeoutMs = Number(env.EFI_TIMEOUT_MS ?? 8_000);
  const common = {
    clientId: env.EFI_CLIENT_ID ?? '',
    clientSecret: env.EFI_CLIENT_SECRET ?? '',
    timeoutMs,
  };
  const config: EfiConfig = {
    enabled: env.EFI_ENABLED === 'true',
    environment,
    nodeEnvironment: env.NODE_ENV ?? 'development',
    billing: {
      kind: 'billing',
      baseUrl:
        env.EFI_BILLING_API_BASE_URL ?? (HOSTS[environment] ? urls(environment, 'billing') : ''),
      oauthPath: '/v1/authorize',
      ...common,
    },
    pix: {
      kind: 'pix',
      baseUrl: env.EFI_PIX_API_BASE_URL ?? (HOSTS[environment] ? urls(environment, 'pix') : ''),
      oauthPath: '/oauth/token',
      ...common,
      certificate: env.EFI_PIX_MTLS_CERTIFICATE ?? '',
      privateKey: env.EFI_PIX_MTLS_PRIVATE_KEY ?? '',
    },
    productionApproved: env.EFI_PRODUCTION_APPROVED === 'true',
  };
  validateEfiConfig(config);
  return config;
}

export function validateEfiConfig(config: EfiConfig): void {
  if (!config.enabled) return;
  const invalid: string[] = [];
  if (!['sandbox', 'production'].includes(config.environment)) invalid.push('EFI_ENVIRONMENT');
  if (!config.billing.clientId) invalid.push('EFI_CLIENT_ID');
  if (!config.billing.clientSecret) invalid.push('EFI_CLIENT_SECRET');
  if (!config.pix.certificate) invalid.push('EFI_PIX_MTLS_CERTIFICATE');
  if (!config.pix.privateKey) invalid.push('EFI_PIX_MTLS_PRIVATE_KEY');
  if (
    !Number.isInteger(config.billing.timeoutMs) ||
    config.billing.timeoutMs < 1_000 ||
    config.billing.timeoutMs > 30_000
  )
    invalid.push('EFI_TIMEOUT_MS');
  for (const profile of [config.billing, config.pix]) validateHost(config, profile, invalid);
  if (config.environment === 'production' && !config.productionApproved)
    invalid.push('EFI_PRODUCTION_APPROVED');
  if (invalid.length)
    throw new Error(`Invalid Efí configuration: ${[...new Set(invalid)].join(', ')}`);
}
function validateHost(config: EfiConfig, profile: EfiApiProfile, invalid: string[]) {
  const key = profile.kind === 'billing' ? 'EFI_BILLING_API_BASE_URL' : 'EFI_PIX_API_BASE_URL';
  try {
    const url = new URL(profile.baseUrl);
    const official = HOSTS[config.environment]?.[profile.kind];
    const overrideAllowed =
      ['test', 'development'].includes(config.nodeEnvironment) &&
      config.environment !== 'production';
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      (url.port !== '' && url.port !== '443') ||
      url.pathname !== '/' ||
      url.search !== '' ||
      url.hash !== '' ||
      (!overrideAllowed && url.hostname !== official)
    )
      invalid.push(key);
  } catch {
    invalid.push(key);
  }
}
export default registerAs('efi', () => readEfiConfig());
