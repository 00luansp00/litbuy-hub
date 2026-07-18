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
    TRUST_PROXY: 'false',
    SERVER_REQUEST_TIMEOUT_MS: '60000',
    AUTH_ACCESS_TOKEN_SECRET: 'test_access_secret_32_chars_long',
    AUTH_ACCESS_TOKEN_TTL_SECONDS: '600',
    AUTH_REFRESH_TOKEN_TTL_DAYS: '30',
    AUTH_REFRESH_TOKEN_PEPPER: 'test_refresh_pepper_32_chars_long',
    AUTH_VERIFICATION_TOKEN_PEPPER: 'test_verification_pepper_32_chars_long',
    AUTH_DEVICE_TOKEN_PEPPER: 'test_device_pepper_32_chars_long',
    AUTH_CSRF_TOKEN_PEPPER: 'test_csrf_pepper_32_chars_long',
    AUTH_IP_HASH_PEPPER: 'test_ip_hash_pepper_32_chars_long',
    AUTH_2FA_RECOVERY_PEPPER: 'test_2fa_recovery_pepper_32_chars_long',
    AUTH_STEP_UP_TOKEN_PEPPER: 'test_step_up_token_pepper_32_chars_long',
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
    PUBLIC_FRONTEND_ORIGIN: 'http://localhost:3000',
    PUBLIC_API_ORIGIN: 'http://localhost:3001',
    AUTH_COOKIE_TOPOLOGY: 'same-origin',
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

  it('rejects wildcard CORS with credentials', () => {
    expect(() => validateEnvironment({ ...validConfig, CORS_ORIGINS: '*' })).toThrow(
      'Invalid environment configuration',
    );
  });

  it('fails closed for unsafe staging settings without leaking values', () => {
    expect(() =>
      validateEnvironment({
        ...validConfig,
        NODE_ENV: 'staging',
        TRUST_PROXY: 'true',
        AUTH_COOKIE_SECURE: 'false',
        AUTH_ACCESS_TOKEN_SECRET: 'local_access_token_secret_change_me_32_chars',
      }),
    ).toThrow(/AUTH_COOKIE_SECURE/);
  });

  it('rejects staging external providers until concrete implementations exist', () => {
    expect(() =>
      validateEnvironment({
        ...validConfig,
        NODE_ENV: 'staging',
        TRUST_PROXY: '1',
        AUTH_COOKIE_SECURE: 'true',
        AUTH_EMAIL_DELIVERY_MODE: 'external',
        AUTH_SMS_DELIVERY_MODE: 'external',
        AUTH_ACCESS_TOKEN_SECRET: 'staging_access_secret_32_chars_long',
        AUTH_REFRESH_TOKEN_PEPPER: 'staging_refresh_pepper_32_chars_long',
        AUTH_VERIFICATION_TOKEN_PEPPER: 'staging_verification_pepper_32_chars',
        AUTH_DEVICE_TOKEN_PEPPER: 'staging_device_pepper_32_chars_long',
        AUTH_CSRF_TOKEN_PEPPER: 'staging_csrf_pepper_32_chars_long',
        AUTH_IP_HASH_PEPPER: 'staging_ip_hash_pepper_32_chars_long',
        AUTH_2FA_RECOVERY_PEPPER: 'staging_2fa_recovery_pepper_32_chars',
        AUTH_STEP_UP_TOKEN_PEPPER: 'staging_step_up_token_pepper_32_chars',
      }),
    ).toThrow(/AUTH_EXTERNAL_PROVIDER_IMPLEMENTATION/);
  });

  it('rejects staging memory providers even when CI-like flags are present', () => {
    expect(() =>
      validateEnvironment({
        ...validConfig,
        NODE_ENV: 'staging',
        CI: 'true',
        TRUST_PROXY: '1',
        AUTH_COOKIE_SECURE: 'true',
        AUTH_EMAIL_DELIVERY_MODE: 'memory',
        AUTH_SMS_DELIVERY_MODE: 'memory',
      }),
    ).toThrow(/AUTH_DELIVERY_MODE/);
  });

  it.each([
    'CORS_ORIGINS',
    'TRUST_PROXY',
    'AUTH_ACCESS_TOKEN_SECRET',
    'AUTH_COOKIE_SAME_SITE',
    'DATABASE_URL',
  ])('fails safely when %s is missing', (key) => {
    const config = {
      ...validConfig,
      NODE_ENV: 'staging',
      DATABASE_URL: 'postgresql://private_user:private_password@db.internal.example/litbuy',
      AUTH_ACCESS_TOKEN_SECRET: 'sensitive_access_secret_value_32_chars',
    };
    delete (config as Record<string, unknown>)[key];
    expect(() => validateEnvironment(config)).toThrow(/Invalid environment configuration/);
    try {
      validateEnvironment(config);
    } catch (error) {
      const message = (error as Error).message;
      expect(message).not.toContain('TypeError');
      expect(message).not.toContain('private_password');
      expect(message).not.toContain('db.internal.example');
      expect(message).not.toContain('sensitive_access_secret_value_32_chars');
    }
  });

  it('fails safely when several required fields are missing', () => {
    const config = { ...validConfig };
    for (const key of ['CORS_ORIGINS', 'TRUST_PROXY', 'AUTH_COOKIE_SAME_SITE', 'DATABASE_URL'])
      delete (config as Record<string, unknown>)[key];
    expect(() => validateEnvironment(config)).toThrow(/Invalid environment configuration/);
  });

  it('validates same-origin cookie topology in hardened environments before provider availability fails', () => {
    expect(() =>
      validateEnvironment({
        ...validConfig,
        NODE_ENV: 'staging',
        TRUST_PROXY: '1',
        AUTH_COOKIE_SECURE: 'true',
        AUTH_EMAIL_DELIVERY_MODE: 'external',
        AUTH_SMS_DELIVERY_MODE: 'external',
        PUBLIC_FRONTEND_ORIGIN: 'https://app.example.test',
        PUBLIC_API_ORIGIN: 'https://api.example.test',
        CORS_ORIGINS: 'https://app.example.test',
      }),
    ).toThrow(/same-origin/);
  });

  it('accepts same-site subdomain cookie topology up to the missing external provider implementation', () => {
    expect(() =>
      validateEnvironment({
        ...validConfig,
        NODE_ENV: 'staging',
        TRUST_PROXY: '1',
        AUTH_COOKIE_SECURE: 'true',
        AUTH_COOKIE_DOMAIN: 'example.test',
        AUTH_COOKIE_TOPOLOGY: 'same-site-subdomains',
        AUTH_EMAIL_DELIVERY_MODE: 'external',
        AUTH_SMS_DELIVERY_MODE: 'external',
        PUBLIC_FRONTEND_ORIGIN: 'https://frontend-staging.example.test',
        PUBLIC_API_ORIGIN: 'https://api-staging.example.test',
        CORS_ORIGINS: 'https://frontend-staging.example.test',
      }),
    ).toThrow(/AUTH_EXTERNAL_PROVIDER_IMPLEMENTATION/);
  });

  it('rejects incompatible shared cookie domain for subdomains', () => {
    expect(() =>
      validateEnvironment({
        ...validConfig,
        NODE_ENV: 'staging',
        TRUST_PROXY: '1',
        AUTH_COOKIE_SECURE: 'true',
        AUTH_COOKIE_DOMAIN: 'wrong.test',
        AUTH_COOKIE_TOPOLOGY: 'same-site-subdomains',
        AUTH_EMAIL_DELIVERY_MODE: 'external',
        AUTH_SMS_DELIVERY_MODE: 'external',
        PUBLIC_FRONTEND_ORIGIN: 'https://frontend-staging.example.test',
        PUBLIC_API_ORIGIN: 'https://api-staging.example.test',
        CORS_ORIGINS: 'https://frontend-staging.example.test',
      }),
    ).toThrow(/AUTH_COOKIE_DOMAIN/);
  });

  it('rejects generic true trust proxy in staging', () => {
    expect(() =>
      validateEnvironment({
        ...validConfig,
        NODE_ENV: 'staging',
        TRUST_PROXY: 'true',
        AUTH_COOKIE_SECURE: 'true',
        AUTH_EMAIL_DELIVERY_MODE: 'external',
        AUTH_SMS_DELIVERY_MODE: 'external',
      }),
    ).toThrow(/TRUST_PROXY/);
  });
});
