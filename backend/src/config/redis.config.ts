import { registerAs } from '@nestjs/config';

export interface RedisConfig {
  url: string;
}

export default registerAs(
  'redis',
  (): RedisConfig => ({
    url: process.env.REDIS_URL ?? '',
  }),
);
