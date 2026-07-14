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
