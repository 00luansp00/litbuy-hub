export function applyTestEnv(overrides: Partial<NodeJS.ProcessEnv> = {}): void {
  process.env.NODE_ENV = overrides.NODE_ENV ?? 'test';
  process.env.PORT = overrides.PORT ?? '3001';
  process.env.API_PREFIX = overrides.API_PREFIX ?? 'api/v1';
  process.env.DATABASE_URL =
    overrides.DATABASE_URL ?? 'postgresql://litbuy:litbuy@localhost:5432/litbuy_test?schema=public';
  process.env.REDIS_URL = overrides.REDIS_URL ?? 'redis://localhost:6379';
  process.env.CORS_ORIGINS = overrides.CORS_ORIGINS ?? 'http://localhost:3000';
  process.env.LOG_LEVEL = overrides.LOG_LEVEL ?? 'silent';
  process.env.SWAGGER_ENABLED = overrides.SWAGGER_ENABLED ?? 'false';
}

applyTestEnv();
