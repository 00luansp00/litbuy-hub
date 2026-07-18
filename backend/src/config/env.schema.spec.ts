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
    AUTH_COOKIE_TOPOLOGY: 'same-host',
    AUTH_EXTERNAL_DELIVERY_TIMEOUT_MS: '5000',
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

  it('rejects removed console email delivery mode', () => {
    expect(() =>
      validateEnvironment({ ...validConfig, AUTH_EMAIL_DELIVERY_MODE: 'console' }),
    ).toThrow(/AUTH_EMAIL_DELIVERY_MODE/);
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

  it('accepts staging external Resend and Twilio providers when complete', () => {
    expect(
      validateEnvironment({
        ...validConfig,
        NODE_ENV: 'staging',
        TRUST_PROXY: '1',
        AUTH_COOKIE_SECURE: 'true',
        PUBLIC_FRONTEND_ORIGIN: 'https://app.example.test',
        PUBLIC_API_ORIGIN: 'https://app.example.test',
        CORS_ORIGINS: 'https://app.example.test',
        AUTH_EMAIL_DELIVERY_MODE: 'external',
        AUTH_EMAIL_PROVIDER: 'resend',
        RESEND_API_KEY: 're_live_configured_secret',
        RESEND_FROM_EMAIL: 'auth@litbuy.invalid',
        RESEND_FROM_NAME: 'LIT Buy',
        AUTH_SMS_DELIVERY_MODE: 'external',
        AUTH_SMS_PROVIDER: 'twilio',
        TWILIO_ACCOUNT_SID: 'AC1234567890abcdef',
        TWILIO_AUTH_TOKEN: 'twilio_configured_secret',
        TWILIO_MESSAGING_SERVICE_SID: 'MG1234567890abcdef',
        AUTH_ACCESS_TOKEN_SECRET: 'staging_access_secret_32_chars_long',
        AUTH_REFRESH_TOKEN_PEPPER: 'staging_refresh_pepper_32_chars_long',
        AUTH_VERIFICATION_TOKEN_PEPPER: 'staging_verification_pepper_32_chars',
        AUTH_DEVICE_TOKEN_PEPPER: 'staging_device_pepper_32_chars_long',
        AUTH_CSRF_TOKEN_PEPPER: 'staging_csrf_pepper_32_chars_long',
        AUTH_IP_HASH_PEPPER: 'staging_ip_hash_pepper_32_chars_long',
        AUTH_2FA_RECOVERY_PEPPER: 'staging_2fa_recovery_pepper_32_chars',
        AUTH_STEP_UP_TOKEN_PEPPER: 'staging_step_up_token_pepper_32_chars',
      }),
    ).toMatchObject({ AUTH_EMAIL_PROVIDER: 'resend', AUTH_SMS_PROVIDER: 'twilio' });
  });

  it.each([
    ['Resend sem API key', { AUTH_EMAIL_PROVIDER: 'resend', RESEND_API_KEY: '' }, /RESEND_API_KEY/],
    [
      'Resend sem remetente',
      { AUTH_EMAIL_PROVIDER: 'resend', RESEND_FROM_EMAIL: '' },
      /RESEND_FROM_EMAIL/,
    ],
    ['provider email desconhecido', { AUTH_EMAIL_PROVIDER: 'unknown' }, /AUTH_EMAIL_PROVIDER/],
    ['Twilio sem Account SID', { TWILIO_ACCOUNT_SID: '' }, /TWILIO_ACCOUNT_SID/],
    ['Twilio sem Auth Token', { TWILIO_AUTH_TOKEN: '' }, /TWILIO_AUTH_TOKEN/],
    [
      'Twilio sem remetente',
      { TWILIO_MESSAGING_SERVICE_SID: '', TWILIO_FROM_NUMBER: '' },
      /TWILIO_SENDER/,
    ],
    ['Twilio com dois remetentes', { TWILIO_FROM_NUMBER: '+15551234567' }, /TWILIO_SENDER/],
    ['provider SMS desconhecido', { AUTH_SMS_PROVIDER: 'unknown' }, /AUTH_SMS_PROVIDER/],
  ])('rejects incomplete external config: %s', (_name, overrides, pattern) => {
    const external = {
      ...validConfig,
      NODE_ENV: 'staging',
      TRUST_PROXY: '1',
      AUTH_COOKIE_SECURE: 'true',
      AUTH_EMAIL_DELIVERY_MODE: 'external',
      AUTH_EMAIL_PROVIDER: 'resend',
      RESEND_API_KEY: 're_live_configured_secret',
      RESEND_FROM_EMAIL: 'auth@litbuy.invalid',
      RESEND_FROM_NAME: 'LIT Buy',
      AUTH_SMS_DELIVERY_MODE: 'external',
      AUTH_SMS_PROVIDER: 'twilio',
      TWILIO_ACCOUNT_SID: 'AC1234567890abcdef',
      TWILIO_AUTH_TOKEN: 'twilio_configured_secret',
      TWILIO_MESSAGING_SERVICE_SID: 'MG1234567890abcdef',
      AUTH_ACCESS_TOKEN_SECRET: 'staging_access_secret_32_chars_long',
      AUTH_REFRESH_TOKEN_PEPPER: 'staging_refresh_pepper_32_chars_long',
      AUTH_VERIFICATION_TOKEN_PEPPER: 'staging_verification_pepper_32_chars',
      AUTH_DEVICE_TOKEN_PEPPER: 'staging_device_pepper_32_chars_long',
      AUTH_CSRF_TOKEN_PEPPER: 'staging_csrf_pepper_32_chars_long',
      AUTH_IP_HASH_PEPPER: 'staging_ip_hash_pepper_32_chars_long',
      AUTH_2FA_RECOVERY_PEPPER: 'staging_2fa_recovery_pepper_32_chars',
      AUTH_STEP_UP_TOKEN_PEPPER: 'staging_step_up_token_pepper_32_chars',
    };
    expect(() => validateEnvironment({ ...external, ...(overrides as object) })).toThrow(pattern);
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
        AUTH_COOKIE_TOPOLOGY: 'same-origin',
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
    ).toThrow(/AUTH_EMAIL_PROVIDER/);
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

  it('accepts HTTPS public origins up to missing external provider implementation', () => {
    expect(() =>
      validateEnvironment({
        ...validConfig,
        NODE_ENV: 'staging',
        TRUST_PROXY: '1',
        AUTH_COOKIE_SECURE: 'true',
        AUTH_COOKIE_TOPOLOGY: 'same-origin',
        AUTH_EMAIL_DELIVERY_MODE: 'external',
        AUTH_SMS_DELIVERY_MODE: 'external',
        PUBLIC_FRONTEND_ORIGIN: 'https://app.example.test',
        PUBLIC_API_ORIGIN: 'https://app.example.test',
        CORS_ORIGINS: 'https://app.example.test/',
      }),
    ).toThrow(/AUTH_EMAIL_PROVIDER/);
  });

  it('rejects remote HTTP public origins without leaking the URL', () => {
    expectInvalidConfigDoesNotLeak(
      {
        ...validConfig,
        NODE_ENV: 'test',
        PUBLIC_FRONTEND_ORIGIN: 'http://frontend.private.example.test',
      },
      ['frontend.private.example.test'],
    );
  });

  it('accepts localhost HTTP public origins in development and test', () => {
    expect(validateEnvironment(validConfig)).toMatchObject({ AUTH_COOKIE_TOPOLOGY: 'same-host' });
    expect(validateEnvironment({ ...validConfig, NODE_ENV: 'development' })).toMatchObject({
      AUTH_COOKIE_TOPOLOGY: 'same-host',
    });
  });

  it.each([
    ['path', 'https://app.example.test/api'],
    ['query', 'https://app.example.test?token=secret'],
    ['fragment', 'https://app.example.test#secret'],
    ['credentials', 'https://user:password@app.example.test'],
    ['null', 'null'],
    ['javascript protocol', 'javascript:alert(1)'],
    ['file protocol', 'file:///tmp/secret'],
    ['ftp protocol', 'ftp://app.example.test'],
  ])('rejects public origin with %s without leaking input', (_caseName, origin) => {
    const forbidden = origin === 'null' ? [] : [origin, 'password'];
    expectInvalidConfigDoesNotLeak(
      { ...validConfig, NODE_ENV: 'staging', PUBLIC_FRONTEND_ORIGIN: origin },
      forbidden,
    );
  });

  it('rejects invalid entries in CORS_ORIGINS without leaking private origins', () => {
    expectInvalidConfigDoesNotLeak(
      {
        ...validConfig,
        NODE_ENV: 'test',
        CORS_ORIGINS: 'http://localhost:3000,https://user:password@private.example.test',
      },
      ['user:password', 'private.example.test'],
    );
  });

  it('rejects staging when the frontend origin is absent from CORS', () => {
    expect(() =>
      validateEnvironment({
        ...validConfig,
        NODE_ENV: 'staging',
        TRUST_PROXY: '1',
        AUTH_COOKIE_SECURE: 'true',
        AUTH_COOKIE_TOPOLOGY: 'same-origin',
        AUTH_EMAIL_DELIVERY_MODE: 'external',
        AUTH_SMS_DELIVERY_MODE: 'external',
        PUBLIC_FRONTEND_ORIGIN: 'https://app.example.test',
        PUBLIC_API_ORIGIN: 'https://app.example.test',
        CORS_ORIGINS: 'https://other.example.test',
      }),
    ).toThrow(/CORS_ORIGINS/);
  });

  it('accepts same-host cookie topology with different localhost ports in tests', () => {
    expect(validateEnvironment(validConfig)).toMatchObject({ AUTH_COOKIE_TOPOLOGY: 'same-host' });
  });

  it('rejects same-host when hosts differ or cookie domain is set', () => {
    expect(() =>
      validateEnvironment({
        ...validConfig,
        NODE_ENV: 'staging',
        TRUST_PROXY: '1',
        AUTH_COOKIE_SECURE: 'true',
        AUTH_COOKIE_TOPOLOGY: 'same-host',
        AUTH_EXTERNAL_DELIVERY_TIMEOUT_MS: '5000',
        AUTH_COOKIE_DOMAIN: 'example.test',
        AUTH_EMAIL_DELIVERY_MODE: 'external',
        AUTH_SMS_DELIVERY_MODE: 'external',
        PUBLIC_FRONTEND_ORIGIN: 'https://frontend.example.test',
        PUBLIC_API_ORIGIN: 'https://api.example.test',
        CORS_ORIGINS: 'https://frontend.example.test',
      }),
    ).toThrow(/same-host/);
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

function expectInvalidConfigDoesNotLeak(config: Record<string, unknown>, forbidden: string[]) {
  try {
    validateEnvironment(config);
    throw new Error('Expected invalid environment configuration');
  } catch (error) {
    const message = (error as Error).message;
    expect(message).toContain('Invalid environment configuration');
    for (const value of forbidden) expect(message).not.toContain(value);
  }
}
