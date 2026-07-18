import { plainToInstance, Transform } from 'class-transformer';
import { isValidTrustProxy } from './trust-proxy';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

const nodeEnvironments = ['development', 'test', 'staging', 'production'] as const;
const sameSites = ['lax', 'strict', 'none'] as const;
const cookieTopologies = [
  'same-origin',
  'same-host',
  'same-site-subdomains',
  'cross-site',
] as const;
const emailModes = ['memory', 'disabled', 'external'] as const;
const smsModes = ['memory', 'disabled', 'external'] as const;
const emailProviders = ['resend'] as const;
const smsProviders = ['twilio'] as const;
const logLevels = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;
const hardenedEnvironments = new Set(['staging', 'production']);
const secretNames = [
  'AUTH_ACCESS_TOKEN_SECRET',
  'AUTH_REFRESH_TOKEN_PEPPER',
  'AUTH_VERIFICATION_TOKEN_PEPPER',
  'AUTH_DEVICE_TOKEN_PEPPER',
  'AUTH_CSRF_TOKEN_PEPPER',
  'AUTH_IP_HASH_PEPPER',
  'AUTH_2FA_RECOVERY_PEPPER',
  'AUTH_STEP_UP_TOKEN_PEPPER',
] as const;

export class EnvironmentVariables {
  @IsIn(nodeEnvironments) NODE_ENV!: (typeof nodeEnvironments)[number];
  @Transform(({ value }) => Number(value)) @IsInt() @Min(1) @Max(65535) PORT!: number;
  @IsString() @IsNotEmpty() API_PREFIX!: string;
  @IsString() @IsNotEmpty() DATABASE_URL!: string;
  @IsUrl({ require_tld: false, protocols: ['redis', 'rediss'] }) REDIS_URL!: string;
  @IsString() CORS_ORIGINS!: string;
  @IsIn(logLevels) LOG_LEVEL!: (typeof logLevels)[number];
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  SWAGGER_ENABLED!: boolean;
  @IsString() @IsNotEmpty() TRUST_PROXY!: string;
  @Transform(({ value }) => Number(value ?? 60_000))
  @IsInt()
  @Min(5_000)
  SERVER_REQUEST_TIMEOUT_MS!: number;
  @IsString() @MinLength(16) AUTH_ACCESS_TOKEN_SECRET!: string;
  @Transform(({ value }) => Number(value ?? 600))
  @IsInt()
  @Min(60)
  AUTH_ACCESS_TOKEN_TTL_SECONDS!: number;
  @Transform(({ value }) => Number(value ?? 30))
  @IsInt()
  @Min(1)
  AUTH_REFRESH_TOKEN_TTL_DAYS!: number;
  @IsString() @MinLength(16) AUTH_REFRESH_TOKEN_PEPPER!: string;
  @IsString() @MinLength(16) AUTH_VERIFICATION_TOKEN_PEPPER!: string;
  @IsString() @MinLength(16) AUTH_DEVICE_TOKEN_PEPPER!: string;
  @IsString() @MinLength(16) AUTH_CSRF_TOKEN_PEPPER!: string;
  @IsString() @MinLength(16) AUTH_IP_HASH_PEPPER!: string;
  @IsString() @MinLength(16) AUTH_2FA_RECOVERY_PEPPER!: string;
  @IsString() @MinLength(16) AUTH_STEP_UP_TOKEN_PEPPER!: string;
  @Transform(({ value }) => Number(value ?? 30))
  @IsInt()
  @Min(1)
  AUTH_EMAIL_VERIFICATION_TTL_MINUTES!: number;
  @Transform(({ value }) => Number(value ?? 30))
  @IsInt()
  @Min(1)
  AUTH_DEVICE_APPROVAL_TTL_MINUTES!: number;
  @Transform(({ value }) => Number(value ?? 30))
  @IsInt()
  @Min(1)
  AUTH_PASSWORD_RESET_TTL_MINUTES!: number;
  @Transform(({ value }) => Number(value ?? 5)) @IsInt() @Min(1) AUTH_MAX_ATTEMPTS!: number;
  @Transform(({ value }) => Number(value ?? 15)) @IsInt() @Min(1) AUTH_LOGIN_LOCK_MINUTES!: number;
  @IsString() @IsNotEmpty() AUTH_REFRESH_COOKIE_NAME!: string;
  @IsString() @IsNotEmpty() AUTH_DEVICE_COOKIE_NAME!: string;
  @IsString() @IsNotEmpty() AUTH_CSRF_COOKIE_NAME!: string;
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  AUTH_COOKIE_SECURE!: boolean;
  @IsIn(sameSites) AUTH_COOKIE_SAME_SITE!: (typeof sameSites)[number];
  @IsString() AUTH_COOKIE_DOMAIN!: string;
  @IsIn(emailModes) AUTH_EMAIL_DELIVERY_MODE!: (typeof emailModes)[number];
  @IsIn(smsModes) AUTH_SMS_DELIVERY_MODE!: (typeof smsModes)[number];
  @IsOptional() @IsIn(emailProviders) AUTH_EMAIL_PROVIDER?: (typeof emailProviders)[number];
  @IsOptional() @IsString() RESEND_API_KEY?: string;
  @IsOptional() @IsString() RESEND_FROM_EMAIL?: string;
  @IsOptional() @IsString() RESEND_FROM_NAME?: string;
  @IsOptional() @IsString() RESEND_REPLY_TO?: string;
  @IsOptional() @IsIn(smsProviders) AUTH_SMS_PROVIDER?: (typeof smsProviders)[number];
  @IsOptional() @IsString() TWILIO_ACCOUNT_SID?: string;
  @IsOptional() @IsString() TWILIO_AUTH_TOKEN?: string;
  @IsOptional() @IsString() TWILIO_MESSAGING_SERVICE_SID?: string;
  @IsOptional() @IsString() TWILIO_FROM_NUMBER?: string;
  @IsOptional()
  @Transform(({ value }) => Number(value ?? 5000))
  @IsInt()
  @Min(1000)
  @Max(30000)
  AUTH_EXTERNAL_DELIVERY_TIMEOUT_MS?: number;
  @Transform(({ value }) => Number(value ?? 10))
  @IsInt()
  @Min(1)
  AUTH_PHONE_VERIFICATION_TTL_MINUTES!: number;
  @Transform(({ value }) => Number(value ?? 60))
  @IsInt()
  @Min(1)
  AUTH_PHONE_RESEND_COOLDOWN_SECONDS!: number;
  @Transform(({ value }) => Number(value ?? 30))
  @IsInt()
  @Min(1)
  AUTH_EMAIL_CHANGE_TTL_MINUTES!: number;
  @Transform(({ value }) => Number(value ?? 48))
  @IsInt()
  @Min(1)
  AUTH_SENSITIVE_CHANGE_HOLD_HOURS!: number;
  @Transform(({ value }) => Number(value ?? 10))
  @IsInt()
  @Min(1)
  AUTH_2FA_CODE_TTL_MINUTES!: number;
  @Transform(({ value }) => Number(value ?? 60))
  @IsInt()
  @Min(1)
  AUTH_2FA_RESEND_COOLDOWN_SECONDS!: number;
  @Transform(({ value }) => Number(value ?? 5)) @IsInt() @Min(1) AUTH_2FA_MAX_ATTEMPTS!: number;
  @Transform(({ value }) => Number(value ?? 10))
  @IsInt()
  @Min(1)
  AUTH_2FA_RECOVERY_CODE_COUNT!: number;
  @Transform(({ value }) => Number(value ?? 10))
  @IsInt()
  @Min(1)
  AUTH_STEP_UP_GRANT_TTL_MINUTES!: number;
  @Transform(({ value }) => Number(value ?? 60))
  @IsInt()
  @Min(1)
  AUTH_STEP_UP_RESEND_COOLDOWN_SECONDS!: number;
  @Transform(({ value }) => Number(value ?? 5)) @IsInt() @Min(1) AUTH_STEP_UP_MAX_ATTEMPTS!: number;
  @IsString() @IsNotEmpty() CURRENT_TERMS_VERSION!: string;
  @IsString() @IsNotEmpty() CURRENT_PRIVACY_VERSION!: string;
  @IsString() @IsNotEmpty() CURRENT_SELLER_AGREEMENT_VERSION!: string;
  @IsString() @IsNotEmpty() PUBLIC_FRONTEND_ORIGIN!: string;
  @IsString() @IsNotEmpty() PUBLIC_API_ORIGIN!: string;
  @IsIn(cookieTopologies)
  AUTH_COOKIE_TOPOLOGY!: (typeof cookieTopologies)[number];
}

export function validateEnvironment(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: false,
  });
  const errors = validateSync(validated, {
    skipMissingProperties: false,
    whitelist: true,
    forbidNonWhitelisted: false,
  });
  if (errors.length > 0) {
    const details = errors.map((error) => ({
      property: error.property,
      constraints: error.constraints ?? {},
    }));
    throw new Error(`Invalid environment configuration: ${JSON.stringify(details)}`);
  }
  const hardeningErrors = validateHardening(validated);
  if (hardeningErrors.length > 0) {
    throw new Error(`Invalid environment configuration: ${JSON.stringify(hardeningErrors)}`);
  }
  return validated;
}

function validateHardening(
  env: EnvironmentVariables,
): Array<{ property: string; constraints: Record<string, string> }> {
  const issues: Array<{ property: string; constraints: Record<string, string> }> = [];
  const origins = env.CORS_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const hardened = hardenedEnvironments.has(env.NODE_ENV);
  const normalizedCorsOrigins = validateCorsOrigins(env, origins, issues);
  if (!isValidTrustProxy(env.TRUST_PROXY))
    issues.push(
      issue(
        'TRUST_PROXY',
        'must be false, a positive hop count, known proxy name, IP, CIDR, or explicit valid list',
      ),
    );
  if (hardened && origins.length === 0)
    issues.push(issue('CORS_ORIGINS', 'explicit origins are required'));
  if (origins.includes('*'))
    issues.push(issue('CORS_ORIGINS', 'wildcard origins are forbidden with credentials'));
  if (hardened && !env.AUTH_COOKIE_SECURE)
    issues.push(issue('AUTH_COOKIE_SECURE', 'secure cookies are required'));
  if (env.AUTH_COOKIE_SAME_SITE === 'none' && !env.AUTH_COOKIE_SECURE)
    issues.push(issue('AUTH_COOKIE_SAME_SITE', 'SameSite=None requires secure cookies'));
  if (hardened && (env.TRUST_PROXY === 'false' || env.TRUST_PROXY.trim() === ''))
    issues.push(issue('TRUST_PROXY', 'explicit HTTPS proxy trust is required'));
  if (hardened && env.TRUST_PROXY === 'true')
    issues.push(
      issue('TRUST_PROXY', 'generic true is forbidden; use hop count or trusted proxy list'),
    );
  if (hardened && env.SWAGGER_ENABLED)
    issues.push(issue('SWAGGER_ENABLED', 'Swagger must not be exposed'));
  if (
    env.NODE_ENV === 'production' &&
    (env.AUTH_EMAIL_DELIVERY_MODE !== 'external' || env.AUTH_SMS_DELIVERY_MODE !== 'external')
  )
    issues.push(
      issue('AUTH_DELIVERY_MODE', 'production requires external email and SMS providers'),
    );
  if (
    env.NODE_ENV === 'staging' &&
    (env.AUTH_EMAIL_DELIVERY_MODE !== 'external' || env.AUTH_SMS_DELIVERY_MODE !== 'external')
  )
    issues.push(
      issue('AUTH_DELIVERY_MODE', 'real staging requires external email and SMS providers'),
    );
  validateExternalDelivery(env, issues, hardened);
  validateCookieTopology(env, normalizedCorsOrigins, issues, hardened);
  for (const name of secretNames) {
    const value = env[name];
    if (hardened && value.length < 32) issues.push(issue(name, 'must be at least 32 characters'));
    if (
      hardened &&
      (value.includes('change_me') ||
        value.includes('<') ||
        value.startsWith('test_') ||
        value.startsWith('local_'))
    )
      issues.push(issue(name, 'placeholder secret is forbidden'));
  }
  return issues;
}

function looksPlaceholder(value: string | undefined): boolean {
  const v = (value ?? '').trim().toLowerCase();
  return (
    !v ||
    v.includes('change_me') ||
    v.includes('placeholder') ||
    v.includes('example') ||
    v.includes('<') ||
    v.includes('test_') ||
    v === 'dummy' ||
    v === 'secret'
  );
}

function requireNonPlaceholder(
  issues: Array<{ property: string; constraints: Record<string, string> }>,
  property: string,
  value: string | undefined,
): void {
  if (looksPlaceholder(value))
    issues.push(issue(property, 'valid external provider value is required'));
}

function validateExternalDelivery(
  env: EnvironmentVariables,
  issues: Array<{ property: string; constraints: Record<string, string> }>,
  hardened: boolean,
): void {
  if (env.AUTH_EMAIL_DELIVERY_MODE === 'memory' && hardened)
    issues.push(
      issue('AUTH_EMAIL_DELIVERY_MODE', 'memory is allowed only in development and test'),
    );
  if (env.AUTH_SMS_DELIVERY_MODE === 'memory' && hardened)
    issues.push(issue('AUTH_SMS_DELIVERY_MODE', 'memory is allowed only in development and test'));
  if (env.AUTH_EMAIL_DELIVERY_MODE === 'external') {
    if (env.AUTH_EMAIL_PROVIDER !== 'resend')
      issues.push(issue('AUTH_EMAIL_PROVIDER', 'external email delivery requires resend'));
    requireNonPlaceholder(issues, 'RESEND_API_KEY', env.RESEND_API_KEY);
    requireNonPlaceholder(issues, 'RESEND_FROM_EMAIL', env.RESEND_FROM_EMAIL);
    requireNonPlaceholder(issues, 'RESEND_FROM_NAME', env.RESEND_FROM_NAME);
  }
  if (env.AUTH_SMS_DELIVERY_MODE === 'external') {
    if (env.AUTH_SMS_PROVIDER !== 'twilio')
      issues.push(issue('AUTH_SMS_PROVIDER', 'external SMS delivery requires twilio'));
    requireNonPlaceholder(issues, 'TWILIO_ACCOUNT_SID', env.TWILIO_ACCOUNT_SID);
    requireNonPlaceholder(issues, 'TWILIO_AUTH_TOKEN', env.TWILIO_AUTH_TOKEN);
    const hasMessagingService = !looksPlaceholder(env.TWILIO_MESSAGING_SERVICE_SID);
    const hasFromNumber = !looksPlaceholder(env.TWILIO_FROM_NUMBER);
    if (hasMessagingService === hasFromNumber)
      issues.push(issue('TWILIO_SENDER', 'configure exactly one Twilio sender strategy'));
    if (env.TWILIO_FROM_NUMBER && !/^\+[1-9]\d{7,14}$/.test(env.TWILIO_FROM_NUMBER))
      issues.push(issue('TWILIO_FROM_NUMBER', 'must be E.164'));
  }
}

function validateCorsOrigins(
  env: EnvironmentVariables,
  origins: string[],
  issues: Array<{ property: string; constraints: Record<string, string> }>,
) {
  const normalized: string[] = [];
  for (const origin of origins) {
    const parsed = safeOrigin(origin, env.NODE_ENV);
    if (!parsed) {
      issues.push(
        issue(
          'CORS_ORIGINS',
          'must contain only valid HTTP/HTTPS origins without credentials, path, query, fragment, wildcard, or null',
        ),
      );
      continue;
    }
    normalized.push(parsed.origin);
  }
  return normalized;
}

function validateCookieTopology(
  env: EnvironmentVariables,
  normalizedCorsOrigins: string[],
  issues: Array<{ property: string; constraints: Record<string, string> }>,
  hardened: boolean,
) {
  const frontend = safeOrigin(env.PUBLIC_FRONTEND_ORIGIN, env.NODE_ENV);
  const api = safeOrigin(env.PUBLIC_API_ORIGIN, env.NODE_ENV);
  if (!frontend)
    issues.push(
      issue(
        'PUBLIC_FRONTEND_ORIGIN',
        'must be a valid HTTP/HTTPS origin without credentials, path, query, or fragment',
      ),
    );
  if (!api)
    issues.push(
      issue(
        'PUBLIC_API_ORIGIN',
        'must be a valid HTTP/HTTPS origin without credentials, path, query, or fragment',
      ),
    );
  if (!frontend || !api) return;
  if (hardened && frontend.protocol !== 'https:')
    issues.push(
      issue('PUBLIC_FRONTEND_ORIGIN', 'staging and production require HTTPS public origins'),
    );
  if (hardened && api.protocol !== 'https:')
    issues.push(issue('PUBLIC_API_ORIGIN', 'staging and production require HTTPS public origins'));
  if (!normalizedCorsOrigins.includes(frontend.origin))
    issues.push(issue('CORS_ORIGINS', 'must include the configured frontend public origin'));
  if (env.AUTH_COOKIE_TOPOLOGY === 'same-origin') {
    if (frontend.origin !== api.origin)
      issues.push(
        issue('AUTH_COOKIE_TOPOLOGY', 'same-origin requires identical scheme, hostname, and port'),
      );
    if (env.AUTH_COOKIE_DOMAIN.trim() !== '')
      issues.push(issue('AUTH_COOKIE_DOMAIN', 'same-origin requires host-only cookies'));
  }
  if (env.AUTH_COOKIE_TOPOLOGY === 'same-host') {
    if (frontend.hostname !== api.hostname)
      issues.push(
        issue('AUTH_COOKIE_TOPOLOGY', 'same-host requires identical frontend and API hostnames'),
      );
    if (env.AUTH_COOKIE_DOMAIN.trim() !== '')
      issues.push(issue('AUTH_COOKIE_DOMAIN', 'same-host requires host-only cookies'));
    if (frontend.origin !== api.origin && !normalizedCorsOrigins.includes(frontend.origin))
      issues.push(
        issue('CORS_ORIGINS', 'same-host with different origins requires the frontend origin'),
      );
  }
  if (env.AUTH_COOKIE_TOPOLOGY === 'same-site-subdomains') {
    const domain = env.AUTH_COOKIE_DOMAIN.trim().replace(/^\./, '');
    if (frontend.hostname === api.hostname)
      issues.push(issue('AUTH_COOKIE_TOPOLOGY', 'same-site subdomains require different hosts'));
    if (!domain) {
      issues.push(
        issue('AUTH_COOKIE_DOMAIN', 'same-site subdomains require the shared parent domain'),
      );
    } else if (!isCookieDomainCompatible(domain, frontend.hostname, api.hostname)) {
      issues.push(
        issue(
          'AUTH_COOKIE_DOMAIN',
          'must match the shared parent domain for frontend and API hosts',
        ),
      );
    }
    if (env.AUTH_COOKIE_SAME_SITE === 'none')
      issues.push(
        issue('AUTH_COOKIE_SAME_SITE', 'same-site subdomains should use lax or strict cookies'),
      );
  }
  if (env.AUTH_COOKIE_TOPOLOGY === 'cross-site') {
    issues.push(
      issue(
        'AUTH_COOKIE_TOPOLOGY',
        'cross-site auth cookies are blocked until a non-cookie CSRF transport is implemented',
      ),
    );
  }
}

function safeOrigin(value: string, nodeEnv: EnvironmentVariables['NODE_ENV']) {
  if (value === 'null' || value === '*') return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
    if (url.username || url.password) return undefined;
    if (url.pathname !== '' && url.pathname !== '/') return undefined;
    if (url.search || url.hash) return undefined;
    if (url.protocol === 'http:' && !isLocalHost(url.hostname)) return undefined;
    if ((nodeEnv === 'staging' || nodeEnv === 'production') && url.protocol !== 'https:')
      return undefined;
    return url;
  } catch {
    return undefined;
  }
}

function isLocalHost(hostname: string) {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]' ||
    hostname === '::1'
  );
}

function isCookieDomainCompatible(domain: string, frontendHost: string, apiHost: string) {
  if (!domain.includes('.') || frontendHost === apiHost) return false;
  return [frontendHost, apiHost].every((host) => host === domain || host.endsWith(`.${domain}`));
}

function issue(property: string, message: string) {
  return { property, constraints: { hardening: message } };
}
