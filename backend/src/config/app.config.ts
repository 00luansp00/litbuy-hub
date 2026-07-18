import { registerAs } from '@nestjs/config';
import { parseTrustProxy, type TrustProxyConfig } from './trust-proxy';

export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'staging' | 'production';
  port: number;
  apiPrefix: string;
  corsOrigins: string[];
  logLevel: string;
  swaggerEnabled: boolean;
  trustProxy: TrustProxyConfig;
  requestTimeoutMs: number;
}

export default registerAs('app', (): AppConfig => {
  const corsOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return {
    nodeEnv: (process.env.NODE_ENV ?? 'development') as AppConfig['nodeEnv'],
    port: Number(process.env.PORT ?? 3001),
    apiPrefix: process.env.API_PREFIX ?? 'api/v1',
    corsOrigins,
    logLevel: process.env.LOG_LEVEL ?? 'info',
    swaggerEnabled: process.env.SWAGGER_ENABLED === 'true',
    trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
    requestTimeoutMs: Number(process.env.SERVER_REQUEST_TIMEOUT_MS ?? 60_000),
  };
});
