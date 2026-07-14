type ManagedEnvKey =
  | 'NODE_ENV'
  | 'PORT'
  | 'API_PREFIX'
  | 'DATABASE_URL'
  | 'REDIS_URL'
  | 'CORS_ORIGINS'
  | 'LOG_LEVEL'
  | 'SWAGGER_ENABLED'
  | 'AUTH_ACCESS_TOKEN_SECRET'
  | 'AUTH_ACCESS_TOKEN_TTL_SECONDS'
  | 'AUTH_REFRESH_TOKEN_TTL_DAYS'
  | 'AUTH_REFRESH_TOKEN_PEPPER'
  | 'AUTH_VERIFICATION_TOKEN_PEPPER'
  | 'AUTH_DEVICE_TOKEN_PEPPER'
  | 'AUTH_CSRF_TOKEN_PEPPER'
  | 'AUTH_IP_HASH_PEPPER'
  | 'AUTH_EMAIL_VERIFICATION_TTL_MINUTES'
  | 'AUTH_DEVICE_APPROVAL_TTL_MINUTES'
  | 'AUTH_MAX_ATTEMPTS'
  | 'AUTH_LOGIN_LOCK_MINUTES'
  | 'AUTH_REFRESH_COOKIE_NAME'
  | 'AUTH_DEVICE_COOKIE_NAME'
  | 'AUTH_CSRF_COOKIE_NAME'
  | 'AUTH_COOKIE_SECURE'
  | 'AUTH_COOKIE_SAME_SITE'
  | 'AUTH_COOKIE_DOMAIN'
  | 'AUTH_EMAIL_DELIVERY_MODE'
  | 'CURRENT_TERMS_VERSION'
  | 'CURRENT_PRIVACY_VERSION';

const defaultTestEnv: Record<ManagedEnvKey, string> = {
  NODE_ENV: 'test',
  PORT: '3001',
  API_PREFIX: 'api/v1',
  DATABASE_URL: 'postgresql://litbuy:litbuy@localhost:5432/litbuy_test?schema=public',
  REDIS_URL: 'redis://localhost:6379',
  CORS_ORIGINS: 'http://localhost:3000',
  LOG_LEVEL: 'silent',
  SWAGGER_ENABLED: 'false',
  AUTH_ACCESS_TOKEN_SECRET: 'test_auth_access_token_secret',
  AUTH_ACCESS_TOKEN_TTL_SECONDS: '600',
  AUTH_REFRESH_TOKEN_TTL_DAYS: '30',
  AUTH_REFRESH_TOKEN_PEPPER: 'test_auth_refresh_token_pepper',
  AUTH_VERIFICATION_TOKEN_PEPPER: 'test_auth_verification_token_pepper',
  AUTH_DEVICE_TOKEN_PEPPER: 'test_auth_device_token_pepper',
  AUTH_CSRF_TOKEN_PEPPER: 'test_auth_csrf_token_pepper',
  AUTH_IP_HASH_PEPPER: 'test_auth_ip_hash_pepper',
  AUTH_EMAIL_VERIFICATION_TTL_MINUTES: '30',
  AUTH_DEVICE_APPROVAL_TTL_MINUTES: '30',
  AUTH_MAX_ATTEMPTS: '5',
  AUTH_LOGIN_LOCK_MINUTES: '15',
  AUTH_REFRESH_COOKIE_NAME: 'litbuy_refresh',
  AUTH_DEVICE_COOKIE_NAME: 'litbuy_device',
  AUTH_CSRF_COOKIE_NAME: 'litbuy_csrf',
  AUTH_COOKIE_SECURE: 'false',
  AUTH_COOKIE_SAME_SITE: 'lax',
  AUTH_COOKIE_DOMAIN: '',
  AUTH_EMAIL_DELIVERY_MODE: 'memory',
  CURRENT_TERMS_VERSION: '2026-test',
  CURRENT_PRIVACY_VERSION: '2026-test',
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
  process.env.AUTH_MAX_ATTEMPTS = resolveTestEnvValue('AUTH_MAX_ATTEMPTS', overrides);
  process.env.AUTH_LOGIN_LOCK_MINUTES = resolveTestEnvValue('AUTH_LOGIN_LOCK_MINUTES', overrides);
  process.env.AUTH_REFRESH_COOKIE_NAME = resolveTestEnvValue('AUTH_REFRESH_COOKIE_NAME', overrides);
  process.env.AUTH_DEVICE_COOKIE_NAME = resolveTestEnvValue('AUTH_DEVICE_COOKIE_NAME', overrides);
  process.env.AUTH_CSRF_COOKIE_NAME = resolveTestEnvValue('AUTH_CSRF_COOKIE_NAME', overrides);
  process.env.AUTH_COOKIE_SECURE = resolveTestEnvValue('AUTH_COOKIE_SECURE', overrides);
  process.env.AUTH_COOKIE_SAME_SITE = resolveTestEnvValue('AUTH_COOKIE_SAME_SITE', overrides);
  process.env.AUTH_COOKIE_DOMAIN = resolveTestEnvValue('AUTH_COOKIE_DOMAIN', overrides);
  process.env.AUTH_EMAIL_DELIVERY_MODE = resolveTestEnvValue('AUTH_EMAIL_DELIVERY_MODE', overrides);
  process.env.CURRENT_TERMS_VERSION = resolveTestEnvValue('CURRENT_TERMS_VERSION', overrides);
  process.env.CURRENT_PRIVACY_VERSION = resolveTestEnvValue('CURRENT_PRIVACY_VERSION', overrides);
}

applyTestEnv();
