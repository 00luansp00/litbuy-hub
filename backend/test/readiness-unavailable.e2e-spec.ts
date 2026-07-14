import { HttpStatus } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { PrismaService } from '../src/database/prisma.service';
import { RedisService } from '../src/redis/redis.service';

describe('Readiness unavailable (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ isHealthy: jest.fn().mockResolvedValue(false) })
      .overrideProvider(RedisService)
      .useValue({ isHealthy: jest.fn().mockResolvedValue(false) })
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns unhealthy readiness without crashing the process', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/health/ready')
      .expect(HttpStatus.SERVICE_UNAVAILABLE)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          statusCode: 503,
          code: 'HTTP_ERROR',
          requestId: expect.any(String),
        });
      });
  });
});
