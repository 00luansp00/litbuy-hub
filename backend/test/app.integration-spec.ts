import { HttpStatus, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { PrismaService } from '../src/database/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import type { AppConfig } from '../src/config/app.config';

describe('App foundation with real PostgreSQL and Redis (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: RedisService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication();
    const config = app.get(ConfigService);
    const appConfig = config.getOrThrow<AppConfig>('app');

    app.setGlobalPrefix(appConfig.apiPrefix);
    app.enableVersioning({ type: VersioningType.URI });
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.useGlobalFilters(new GlobalExceptionFilter());

    await app.init();

    prisma = app.get(PrismaService);
    redis = app.get(RedisService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('keeps Swagger disabled when SWAGGER_ENABLED=false', () => {
    const config = app.get(ConfigService);

    expect(config.getOrThrow<AppConfig>('app').swaggerEnabled).toBe(false);
  });

  it('confirms direct real PostgreSQL and Redis connections', async () => {
    await expect(prisma.$queryRaw`SELECT 1`).resolves.toEqual([{ '?column?': 1 }]);
    await expect((await redis.getClient()).ping()).resolves.toBe('PONG');
  });

  it('serves liveness without duplicating the API version prefix', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/health/live')
      .expect(HttpStatus.OK)
      .expect(({ body }) => {
        expect(body).toMatchObject({ status: 'ok' });
        expect(JSON.stringify(body)).not.toContain(process.env.DATABASE_URL);
      });

    await request(app.getHttpServer()).get('/api/v1/v1/health/live').expect(HttpStatus.NOT_FOUND);
  });

  it('returns ready with real PostgreSQL and Redis marked up and no secrets', async () => {
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
        const serializedBody = JSON.stringify(body);
        expect(serializedBody).not.toContain(process.env.DATABASE_URL);
        expect(serializedBody).not.toContain('litbuy_ci_integration_password');
      });
  });
});
