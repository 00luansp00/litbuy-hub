import { validateEnvironment } from './env.schema';

describe('validateEnvironment', () => {
  const validConfig = {
    NODE_ENV: 'test',
    PORT: '3001',
    API_PREFIX: 'api/v1',
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/db?schema=public',
    REDIS_URL: 'redis://localhost:6379',
    CORS_ORIGINS: 'http://localhost:3000',
    LOG_LEVEL: 'silent',
    SWAGGER_ENABLED: 'false',
    AUTH_ACCESS_TOKEN_SECRET: 'test_access_secret',
    AUTH_ACCESS_TOKEN_TTL_SECONDS: '600',
    AUTH_REFRESH_TOKEN_TTL_DAYS: '30',
    AUTH_REFRESH_TOKEN_PEPPER: 'test_refresh',
    AUTH_VERIFICATION_TOKEN_PEPPER: 'test_verification',
    AUTH_DEVICE_TOKEN_PEPPER: 'test_device',
    AUTH_CSRF_TOKEN_PEPPER: 'test_csrf',
    AUTH_IP_HASH_PEPPER: 'test_ip',
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
    CURRENT_TERMS_VERSION: '2026-test',
    CURRENT_PRIVACY_VERSION: '2026-test',
  };

  it('accepts the required backend environment variables', () => {
    expect(validateEnvironment(validConfig)).toMatchObject({
      NODE_ENV: 'test',
      PORT: 3001,
      API_PREFIX: 'api/v1',
      SWAGGER_ENABLED: false,
    });
  });

  it('rejects invalid environment variables', () => {
    expect(() => validateEnvironment({ ...validConfig, PORT: 'invalid' })).toThrow(
      'Invalid environment configuration',
    );
  });
});
