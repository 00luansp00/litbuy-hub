import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis;

  constructor(configService: ConfigService) {
    const redisUrl = configService.getOrThrow<string>('redis.url');
    this.client = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      connectTimeout: 2_000,
      commandTimeout: 2_000,
    });
    this.client.on('error', () => undefined);
  }

  async getClient(): Promise<Redis> {
    if (this.client.status === 'wait') {
      await this.client.connect();
    }

    return this.client;
  }

  async isHealthy(): Promise<boolean> {
    try {
      const client = await this.getClient();
      return (await client.ping()) === 'PONG';
    } catch {
      return false;
    }
  }

  onModuleDestroy(): void {
    if (this.client.status !== 'end') {
      this.client.disconnect();
    }
  }
}
