import { applyTestEnv } from './test-env';

const managedEnvKeys = [
  'NODE_ENV',
  'PORT',
  'API_PREFIX',
  'DATABASE_URL',
  'REDIS_URL',
  'CORS_ORIGINS',
  'LOG_LEVEL',
  'SWAGGER_ENABLED',
  'TRUST_PROXY',
  'SERVER_REQUEST_TIMEOUT_MS',
] as const;

describe('applyTestEnv', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    for (const key of managedEnvKeys) {
      delete process.env[key];
    }
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('preserves existing process.env values instead of replacing them with defaults', () => {
    process.env.DATABASE_URL = 'postgresql://env-user:env-pass@localhost:5432/env-db?schema=public';
    process.env.REDIS_URL = 'redis://localhost:6380';

    applyTestEnv();

    expect(process.env.DATABASE_URL).toBe(
      'postgresql://env-user:env-pass@localhost:5432/env-db?schema=public',
    );
    expect(process.env.REDIS_URL).toBe('redis://localhost:6380');
  });

  it('gives explicit overrides priority over existing process.env values', () => {
    process.env.DATABASE_URL = 'postgresql://env-user:env-pass@localhost:5432/env-db?schema=public';

    applyTestEnv({
      DATABASE_URL:
        'postgresql://override-user:override-pass@localhost:5432/override-db?schema=public',
    });

    expect(process.env.DATABASE_URL).toBe(
      'postgresql://override-user:override-pass@localhost:5432/override-db?schema=public',
    );
  });

  it('uses defaults only when neither an override nor process.env value exists', () => {
    applyTestEnv();

    expect(process.env.NODE_ENV).toBe('test');
    expect(process.env.PORT).toBe('3001');
    expect(process.env.API_PREFIX).toBe('api/v1');
    expect(process.env.DATABASE_URL).toBe(
      'postgresql://litbuy:litbuy@localhost:5432/litbuy_test?schema=public',
    );
    expect(process.env.REDIS_URL).toBe('redis://localhost:6379');
    expect(process.env.CORS_ORIGINS).toBe('http://localhost:3000');
    expect(process.env.LOG_LEVEL).toBe('silent');
    expect(process.env.TRUST_PROXY).toBe('false');
    expect(process.env.SERVER_REQUEST_TIMEOUT_MS).toBe('60000');
  });

  it('preserves SWAGGER_ENABLED="false" from process.env', () => {
    process.env.SWAGGER_ENABLED = 'false';

    applyTestEnv();

    expect(process.env.SWAGGER_ENABLED).toBe('false');
  });
});
