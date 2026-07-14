type ManagedEnvKey =
  | 'NODE_ENV'
  | 'PORT'
  | 'API_PREFIX'
  | 'DATABASE_URL'
  | 'REDIS_URL'
  | 'CORS_ORIGINS'
  | 'LOG_LEVEL'
  | 'SWAGGER_ENABLED';

const defaultTestEnv: Record<ManagedEnvKey, string> = {
  NODE_ENV: 'test',
  PORT: '3001',
  API_PREFIX: 'api/v1',
  DATABASE_URL: 'postgresql://litbuy:litbuy@localhost:5432/litbuy_test?schema=public',
  REDIS_URL: 'redis://localhost:6379',
  CORS_ORIGINS: 'http://localhost:3000',
  LOG_LEVEL: 'silent',
  SWAGGER_ENABLED: 'false',
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
}

applyTestEnv();
