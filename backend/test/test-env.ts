type ManagedEnvKey =
  | 'NODE_ENV'
  | 'PORT'
  | 'API_PREFIX'
  | 'DATABASE_URL'
  | 'REDIS_URL'
  | 'CORS_ORIGINS'
  | 'LOG_LEVEL'
  | 'SWAGGER_ENABLED'
  | 'TRUST_PROXY'
  | 'SERVER_REQUEST_TIMEOUT_MS'
  | 'AUTH_ACCESS_TOKEN_SECRET'
  | 'AUTH_ACCESS_TOKEN_TTL_SECONDS'
  | 'AUTH_REFRESH_TOKEN_TTL_DAYS'
  | 'AUTH_REFRESH_TOKEN_PEPPER'
  | 'AUTH_VERIFICATION_TOKEN_PEPPER'
  | 'AUTH_DEVICE_TOKEN_PEPPER'
  | 'AUTH_CSRF_TOKEN_PEPPER'
  | 'AUTH_IP_HASH_PEPPER'
  | 'AUTH_2FA_RECOVERY_PEPPER'
  | 'AUTH_STEP_UP_TOKEN_PEPPER'
  | 'AUTH_STEP_UP_GRANT_TTL_MINUTES'
  | 'AUTH_STEP_UP_RESEND_COOLDOWN_SECONDS'
  | 'AUTH_STEP_UP_MAX_ATTEMPTS'
  | 'AUTH_EMAIL_VERIFICATION_TTL_MINUTES'
  | 'AUTH_DEVICE_APPROVAL_TTL_MINUTES'
  | 'AUTH_PASSWORD_RESET_TTL_MINUTES'
  | 'AUTH_MAX_ATTEMPTS'
  | 'AUTH_LOGIN_LOCK_MINUTES'
  | 'AUTH_REFRESH_COOKIE_NAME'
  | 'AUTH_DEVICE_COOKIE_NAME'
  | 'AUTH_CSRF_COOKIE_NAME'
  | 'AUTH_COOKIE_SECURE'
  | 'AUTH_COOKIE_SAME_SITE'
  | 'AUTH_COOKIE_DOMAIN'
  | 'AUTH_EMAIL_DELIVERY_MODE'
  | 'AUTH_SMS_DELIVERY_MODE'
  | 'AUTH_PHONE_VERIFICATION_TTL_MINUTES'
  | 'AUTH_PHONE_RESEND_COOLDOWN_SECONDS'
  | 'AUTH_EMAIL_CHANGE_TTL_MINUTES'
  | 'AUTH_SENSITIVE_CHANGE_HOLD_HOURS'
  | 'AUTH_2FA_CODE_TTL_MINUTES'
  | 'AUTH_2FA_RESEND_COOLDOWN_SECONDS'
  | 'AUTH_2FA_MAX_ATTEMPTS'
  | 'AUTH_2FA_RECOVERY_CODE_COUNT'
  | 'CURRENT_TERMS_VERSION'
  | 'CURRENT_PRIVACY_VERSION'
  | 'CURRENT_SELLER_AGREEMENT_VERSION'
  | 'PUBLIC_FRONTEND_ORIGIN'
  | 'PUBLIC_API_ORIGIN'
  | 'AUTH_COOKIE_TOPOLOGY';

const defaultTestEnv: Record<ManagedEnvKey, string> = {
  NODE_ENV: 'test',
  PORT: '3001',
  API_PREFIX: 'api/v1',
  DATABASE_URL: 'postgresql://litbuy:litbuy@localhost:5432/litbuy_test?schema=public',
  REDIS_URL: 'redis://localhost:6379',
  CORS_ORIGINS: 'http://localhost:3000',
  LOG_LEVEL: 'silent',
  SWAGGER_ENABLED: 'false',
  TRUST_PROXY: 'false',
  SERVER_REQUEST_TIMEOUT_MS: '60000',
  AUTH_ACCESS_TOKEN_SECRET: 'test_auth_access_token_secret',
  AUTH_ACCESS_TOKEN_TTL_SECONDS: '600',
  AUTH_REFRESH_TOKEN_TTL_DAYS: '30',
  AUTH_REFRESH_TOKEN_PEPPER: 'test_auth_refresh_token_pepper',
  AUTH_VERIFICATION_TOKEN_PEPPER: 'test_auth_verification_token_pepper',
  AUTH_DEVICE_TOKEN_PEPPER: 'test_auth_device_token_pepper',
  AUTH_CSRF_TOKEN_PEPPER: 'test_auth_csrf_token_pepper',
  AUTH_IP_HASH_PEPPER: 'test_auth_ip_hash_pepper',
  AUTH_2FA_RECOVERY_PEPPER: 'test_auth_2fa_recovery_pepper',
  AUTH_STEP_UP_TOKEN_PEPPER: 'test_step_up_token_pepper',
  AUTH_STEP_UP_GRANT_TTL_MINUTES: '10',
  AUTH_STEP_UP_RESEND_COOLDOWN_SECONDS: '60',
  AUTH_STEP_UP_MAX_ATTEMPTS: '5',
  AUTH_EMAIL_VERIFICATION_TTL_MINUTES: '30',
  AUTH_DEVICE_APPROVAL_TTL_MINUTES: '30',
  AUTH_PASSWORD_RESET_TTL_MINUTES: '30',
  AUTH_MAX_ATTEMPTS: '5',
  AUTH_LOGIN_LOCK_MINUTES: '15',
  AUTH_REFRESH_COOKIE_NAME: 'litbuy_refresh',
  AUTH_DEVICE_COOKIE_NAME: 'litbuy_device',
  AUTH_CSRF_COOKIE_NAME: 'litbuy_csrf',
  AUTH_COOKIE_SECURE: 'false',
  AUTH_COOKIE_SAME_SITE: 'lax',
  AUTH_COOKIE_DOMAIN: '',
  AUTH_EMAIL_DELIVERY_MODE: 'memory',
  AUTH_SMS_DELIVERY_MODE: 'memory',
  AUTH_PHONE_VERIFICATION_TTL_MINUTES: '10',
  AUTH_PHONE_RESEND_COOLDOWN_SECONDS: '60',
  AUTH_EMAIL_CHANGE_TTL_MINUTES: '30',
  AUTH_SENSITIVE_CHANGE_HOLD_HOURS: '48',
  AUTH_2FA_CODE_TTL_MINUTES: '10',
  AUTH_2FA_RESEND_COOLDOWN_SECONDS: '60',
  AUTH_2FA_MAX_ATTEMPTS: '5',
  AUTH_2FA_RECOVERY_CODE_COUNT: '10',
  CURRENT_TERMS_VERSION: '2026-test',
  CURRENT_PRIVACY_VERSION: '2026-test',
  CURRENT_SELLER_AGREEMENT_VERSION: '2026-test',
  PUBLIC_FRONTEND_ORIGIN: 'http://localhost:3000',
  PUBLIC_API_ORIGIN: 'http://localhost:3001',
  AUTH_COOKIE_TOPOLOGY: 'same-host',
};

function resolveTestEnvValue(key: ManagedEnvKey, overrides: Partial<NodeJS.ProcessEnv>): string {
  return overrides[key] ?? process.env[key] ?? defaultTestEnv[key];
}

export function applyTestEnv(overrides: Partial<NodeJS.ProcessEnv> = {}): void {
  process.env.NODE_ENV = resolveTestEnvValue('NODE_ENV', overrides);
  process.env.PORT = resolveTestEnvValue('PORT', overrides);
  process.env.API_PREFIX = resolveTestEnvValue('API_PREFIX', overrides);
  process.env.DATABASE_URL = resolveTestEnvValue('DATABASE_URL', overrides);
  process.env.REDIS_URL = resolveTestEnvValue('REDIS_URL', overrides);
  process.env.CORS_ORIGINS = resolveTestEnvValue('CORS_ORIGINS', overrides);
  process.env.LOG_LEVEL = resolveTestEnvValue('LOG_LEVEL', overrides);
  process.env.SWAGGER_ENABLED = resolveTestEnvValue('SWAGGER_ENABLED', overrides);
  process.env.TRUST_PROXY = resolveTestEnvValue('TRUST_PROXY', overrides);
  process.env.SERVER_REQUEST_TIMEOUT_MS = resolveTestEnvValue(
    'SERVER_REQUEST_TIMEOUT_MS',
    overrides,
  );
  process.env.AUTH_ACCESS_TOKEN_SECRET = resolveTestEnvValue('AUTH_ACCESS_TOKEN_SECRET', overrides);
  process.env.AUTH_ACCESS_TOKEN_TTL_SECONDS = resolveTestEnvValue(
    'AUTH_ACCESS_TOKEN_TTL_SECONDS',
    overrides,
  );
  process.env.AUTH_REFRESH_TOKEN_TTL_DAYS = resolveTestEnvValue(
    'AUTH_REFRESH_TOKEN_TTL_DAYS',
    overrides,
  );
  process.env.AUTH_REFRESH_TOKEN_PEPPER = resolveTestEnvValue(
    'AUTH_REFRESH_TOKEN_PEPPER',
    overrides,
  );
  process.env.AUTH_VERIFICATION_TOKEN_PEPPER = resolveTestEnvValue(
    'AUTH_VERIFICATION_TOKEN_PEPPER',
    overrides,
  );
  process.env.AUTH_DEVICE_TOKEN_PEPPER = resolveTestEnvValue('AUTH_DEVICE_TOKEN_PEPPER', overrides);
  process.env.AUTH_CSRF_TOKEN_PEPPER = resolveTestEnvValue('AUTH_CSRF_TOKEN_PEPPER', overrides);
  process.env.AUTH_IP_HASH_PEPPER = resolveTestEnvValue('AUTH_IP_HASH_PEPPER', overrides);
  process.env.AUTH_EMAIL_VERIFICATION_TTL_MINUTES = resolveTestEnvValue(
    'AUTH_EMAIL_VERIFICATION_TTL_MINUTES',
    overrides,
  );
  process.env.AUTH_DEVICE_APPROVAL_TTL_MINUTES = resolveTestEnvValue(
    'AUTH_DEVICE_APPROVAL_TTL_MINUTES',
    overrides,
  );
  process.env.AUTH_PASSWORD_RESET_TTL_MINUTES = resolveTestEnvValue(
    'AUTH_PASSWORD_RESET_TTL_MINUTES',
    overrides,
  );
  process.env.AUTH_MAX_ATTEMPTS = resolveTestEnvValue('AUTH_MAX_ATTEMPTS', overrides);
  process.env.AUTH_LOGIN_LOCK_MINUTES = resolveTestEnvValue('AUTH_LOGIN_LOCK_MINUTES', overrides);
  process.env.AUTH_REFRESH_COOKIE_NAME = resolveTestEnvValue('AUTH_REFRESH_COOKIE_NAME', overrides);
  process.env.AUTH_DEVICE_COOKIE_NAME = resolveTestEnvValue('AUTH_DEVICE_COOKIE_NAME', overrides);
  process.env.AUTH_CSRF_COOKIE_NAME = resolveTestEnvValue('AUTH_CSRF_COOKIE_NAME', overrides);
  process.env.AUTH_COOKIE_SECURE = resolveTestEnvValue('AUTH_COOKIE_SECURE', overrides);
  process.env.AUTH_COOKIE_SAME_SITE = resolveTestEnvValue('AUTH_COOKIE_SAME_SITE', overrides);
  process.env.AUTH_COOKIE_DOMAIN = resolveTestEnvValue('AUTH_COOKIE_DOMAIN', overrides);
  process.env.AUTH_EMAIL_DELIVERY_MODE = resolveTestEnvValue('AUTH_EMAIL_DELIVERY_MODE', overrides);
  process.env.AUTH_SMS_DELIVERY_MODE = resolveTestEnvValue('AUTH_SMS_DELIVERY_MODE', overrides);
  process.env.AUTH_PHONE_VERIFICATION_TTL_MINUTES = resolveTestEnvValue(
    'AUTH_PHONE_VERIFICATION_TTL_MINUTES',
    overrides,
  );
  process.env.AUTH_PHONE_RESEND_COOLDOWN_SECONDS = resolveTestEnvValue(
    'AUTH_PHONE_RESEND_COOLDOWN_SECONDS',
    overrides,
  );
  process.env.AUTH_EMAIL_CHANGE_TTL_MINUTES = resolveTestEnvValue(
    'AUTH_EMAIL_CHANGE_TTL_MINUTES',
    overrides,
  );
  process.env.AUTH_SENSITIVE_CHANGE_HOLD_HOURS = resolveTestEnvValue(
    'AUTH_SENSITIVE_CHANGE_HOLD_HOURS',
    overrides,
  );
  process.env.AUTH_2FA_RECOVERY_PEPPER = resolveTestEnvValue('AUTH_2FA_RECOVERY_PEPPER', overrides);
  process.env.AUTH_2FA_CODE_TTL_MINUTES = resolveTestEnvValue(
    'AUTH_2FA_CODE_TTL_MINUTES',
    overrides,
  );
  process.env.AUTH_2FA_RESEND_COOLDOWN_SECONDS = resolveTestEnvValue(
    'AUTH_2FA_RESEND_COOLDOWN_SECONDS',
    overrides,
  );
  process.env.AUTH_2FA_MAX_ATTEMPTS = resolveTestEnvValue('AUTH_2FA_MAX_ATTEMPTS', overrides);
  process.env.AUTH_2FA_RECOVERY_CODE_COUNT = resolveTestEnvValue(
    'AUTH_2FA_RECOVERY_CODE_COUNT',
    overrides,
  );
  process.env.AUTH_STEP_UP_TOKEN_PEPPER = resolveTestEnvValue(
    'AUTH_STEP_UP_TOKEN_PEPPER',
    overrides,
  );
  process.env.AUTH_STEP_UP_GRANT_TTL_MINUTES = resolveTestEnvValue(
    'AUTH_STEP_UP_GRANT_TTL_MINUTES',
    overrides,
  );
  process.env.AUTH_STEP_UP_RESEND_COOLDOWN_SECONDS = resolveTestEnvValue(
    'AUTH_STEP_UP_RESEND_COOLDOWN_SECONDS',
    overrides,
  );
  process.env.AUTH_STEP_UP_MAX_ATTEMPTS = resolveTestEnvValue(
    'AUTH_STEP_UP_MAX_ATTEMPTS',
    overrides,
  );
  process.env.CURRENT_TERMS_VERSION = resolveTestEnvValue('CURRENT_TERMS_VERSION', overrides);
  process.env.CURRENT_PRIVACY_VERSION = resolveTestEnvValue('CURRENT_PRIVACY_VERSION', overrides);
  process.env.CURRENT_SELLER_AGREEMENT_VERSION = resolveTestEnvValue(
    'CURRENT_SELLER_AGREEMENT_VERSION',
    overrides,
  );
  process.env.PUBLIC_FRONTEND_ORIGIN = resolveTestEnvValue('PUBLIC_FRONTEND_ORIGIN', overrides);
  process.env.PUBLIC_API_ORIGIN = resolveTestEnvValue('PUBLIC_API_ORIGIN', overrides);
  process.env.AUTH_COOKIE_TOPOLOGY = resolveTestEnvValue('AUTH_COOKIE_TOPOLOGY', overrides);
}

applyTestEnv();

process.env.AUTH_2FA_RECOVERY_PEPPER ||= 'test-2fa-recovery-pepper';
process.env.AUTH_2FA_CODE_TTL_MINUTES ||= '10';
process.env.AUTH_2FA_RESEND_COOLDOWN_SECONDS ||= '60';
process.env.AUTH_2FA_MAX_ATTEMPTS ||= '5';
process.env.AUTH_2FA_RECOVERY_CODE_COUNT ||= '10';

process.env.AUTH_STEP_UP_TOKEN_PEPPER ||= 'test-step-up-pepper';
process.env.AUTH_STEP_UP_GRANT_TTL_MINUTES ||= '10';
process.env.AUTH_STEP_UP_RESEND_COOLDOWN_SECONDS ||= '60';
process.env.AUTH_STEP_UP_MAX_ATTEMPTS ||= '5';
