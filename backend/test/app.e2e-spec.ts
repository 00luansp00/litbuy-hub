import { HttpStatus, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { PrismaService } from '../src/database/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { applyTestEnv } from './test-env';

applyTestEnv();

describe('App foundation (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ isHealthy: jest.fn().mockResolvedValue(true) })
      .overrideProvider(RedisService)
      .useValue({ isHealthy: jest.fn().mockResolvedValue(true) })
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('initializes and returns liveness', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/health/live')
      .expect(HttpStatus.OK)
      .expect(({ body }) => {
        expect(body).toMatchObject({ status: 'ok' });
      });
  });

  it('returns readiness when dependencies are healthy', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/health/ready')
      .expect(HttpStatus.OK)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          status: 'ok',
          dependencies: {
            postgres: { status: 'up' },
            redis: { status: 'up' },
          },
        });
      });
  });

  it('generates a request id when none is provided', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/health/live')
      .expect(HttpStatus.OK)
      .expect((response) => {
        expect(response.headers['x-request-id']).toEqual(expect.any(String));
      });
  });
});
