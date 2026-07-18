import { plainToInstance, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsString,
  IsUrl,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

const nodeEnvironments = ['development', 'test', 'staging', 'production'] as const;
const sameSites = ['lax', 'strict', 'none'] as const;
const emailModes = ['memory', 'console', 'disabled', 'external'] as const;
const smsModes = ['memory', 'disabled', 'external'] as const;
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
  const hardeningErrors = validateHardening(validated);
  if (errors.length > 0 || hardeningErrors.length > 0) {
    const details = errors.map((error) => ({
      property: error.property,
      constraints: error.constraints ?? {},
    }));
    throw new Error(
      `Invalid environment configuration: ${JSON.stringify([...details, ...hardeningErrors])}`,
    );
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
  if (hardened)
    issues.push(
      issue(
        'AUTH_EXTERNAL_PROVIDER_IMPLEMENTATION',
        'external email/SMS provider implementation is not installed in this sprint',
      ),
    );
  for (const name of secretNames) {
    const value = env[name];
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

function issue(property: string, message: string) {
  return { property, constraints: { hardening: message } };
}
