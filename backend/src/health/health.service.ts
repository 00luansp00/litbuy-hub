import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';

export interface DependencyHealth {
  status: 'up' | 'down';
}

export interface HealthResponse {
  status: 'ok' | 'error';
  timestamp: string;
  dependencies?: {
    postgres: DependencyHealth;
    redis: DependencyHealth;
  };
}

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  live(): HealthResponse {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  async ready(): Promise<HealthResponse> {
    const [postgresHealthy, redisHealthy] = await Promise.all([
      this.prisma.isHealthy(),
      this.redis.isHealthy(),
    ]);

    const response: HealthResponse = {
      status: postgresHealthy && redisHealthy ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      dependencies: {
        postgres: { status: postgresHealthy ? 'up' : 'down' },
        redis: { status: redisHealthy ? 'up' : 'down' },
      },
    };

    if (response.status === 'error') {
      throw new ServiceUnavailableException(response);
    }

    return response;
  }
}
