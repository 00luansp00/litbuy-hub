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
  validateSync,
} from 'class-validator';

const nodeEnvironments = ['development', 'test', 'production'] as const;
const sameSites = ['lax', 'strict', 'none'] as const;
const emailModes = ['memory', 'console', 'disabled'] as const;
const smsModes = ['memory', 'disabled'] as const;
const logLevels = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;

export class EnvironmentVariables {
  @IsIn(nodeEnvironments)
  NODE_ENV!: (typeof nodeEnvironments)[number];

  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT!: number;

  @IsString()
  @IsNotEmpty()
  API_PREFIX!: string;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsUrl({ require_tld: false, protocols: ['redis', 'rediss'] })
  REDIS_URL!: string;

  @IsString()
  CORS_ORIGINS!: string;

  @IsIn(logLevels)
  LOG_LEVEL!: (typeof logLevels)[number];

  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  SWAGGER_ENABLED!: boolean;

  @IsString() @IsNotEmpty() AUTH_ACCESS_TOKEN_SECRET!: string;
  @Transform(({ value }) => Number(value ?? 600))
  @IsInt()
  @Min(60)
  AUTH_ACCESS_TOKEN_TTL_SECONDS!: number;
  @Transform(({ value }) => Number(value ?? 30))
  @IsInt()
  @Min(1)
  AUTH_REFRESH_TOKEN_TTL_DAYS!: number;
  @IsString() @IsNotEmpty() AUTH_REFRESH_TOKEN_PEPPER!: string;
  @IsString() @IsNotEmpty() AUTH_VERIFICATION_TOKEN_PEPPER!: string;
  @IsString() @IsNotEmpty() AUTH_DEVICE_TOKEN_PEPPER!: string;
  @IsString() @IsNotEmpty() AUTH_CSRF_TOKEN_PEPPER!: string;
  @IsString() @IsNotEmpty() AUTH_IP_HASH_PEPPER!: string;
  @IsString() @IsNotEmpty() AUTH_2FA_RECOVERY_PEPPER!: string;
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

  if (errors.length > 0) {
    const details = errors.map((error) => ({
      property: error.property,
      constraints: error.constraints ?? {},
    }));
    throw new Error(`Invalid environment configuration: ${JSON.stringify(details)}`);
  }

  return validated;
}
