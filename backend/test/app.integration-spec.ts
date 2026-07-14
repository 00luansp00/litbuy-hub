import cookieParser from 'cookie-parser';
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
import { AuthMailer } from '../src/auth/auth.service';

describe('App foundation with real PostgreSQL and Redis (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  let mailer: AuthMailer;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication();
    const config = app.get(ConfigService);
    const appConfig = config.getOrThrow<AppConfig>('app');

    app.setGlobalPrefix(appConfig.apiPrefix);
    app.enableVersioning({ type: VersioningType.URI });
    app.use(cookieParser());
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
    mailer = app.get(AuthMailer);
  });

  beforeEach(async () => {
    await prisma.securityEvent.deleteMany();
    await prisma.sessionRefreshToken.deleteMany();
    await prisma.session.deleteMany();
    await prisma.verificationChallenge.deleteMany();
    await prisma.device.deleteMany();
    await prisma.passwordCredential.deleteMany();
    await prisma.user.deleteMany();
    mailer.sent.splice(0);
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

  it('executes real auth registration, verification, login, refresh rotation, reuse detection and logout', async () => {
    const payload = {
      email: 'integration-auth@example.com',
      password: 'integration password 123',
      birthDate: '2000-01-01',
      termsAccepted: true,
      privacyAccepted: true,
      termsVersion: process.env.CURRENT_TERMS_VERSION,
      privacyVersion: process.env.CURRENT_PRIVACY_VERSION,
    };
    const register = await request(app.getHttpServer())
      .post('/api/v1/v1/auth/register')
      .send(payload)
      .expect(HttpStatus.CREATED);
    expect(register.body).not.toHaveProperty('token');
    const deviceCookie = register.headers['set-cookie'] as unknown as string[];
    const emailToken = mailer.sent.find(
      (message) => message.purpose === 'EMAIL_VERIFICATION',
    )?.token;
    expect(emailToken).toEqual(expect.any(String));
    await request(app.getHttpServer())
      .post('/api/v1/v1/auth/email/verify')
      .send({ token: emailToken })
      .expect(HttpStatus.OK);
    const login = await request(app.getHttpServer())
      .post('/api/v1/v1/auth/login')
      .set('Cookie', deviceCookie)
      .send({ email: payload.email, password: payload.password })
      .expect(HttpStatus.OK);
    expect(login.body.accessToken).toEqual(expect.any(String));
    await request(app.getHttpServer())
      .get('/api/v1/v1/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(HttpStatus.OK);
    const authCookies = login.headers['set-cookie'] as unknown as string[];
    const csrf = String(authCookies.find((cookie) => cookie.startsWith('litbuy_csrf')))
      .split(';')[0]
      .split('=')[1];
    const oldRefreshCookie = String(
      authCookies.find((cookie) => cookie.startsWith('litbuy_refresh')),
    );
    await request(app.getHttpServer())
      .post('/api/v1/v1/auth/refresh')
      .set('Cookie', authCookies)
      .set('X-CSRF-Token', csrf)
      .expect(HttpStatus.OK);
    await request(app.getHttpServer())
      .post('/api/v1/v1/auth/refresh')
      .set('Cookie', [oldRefreshCookie, `litbuy_csrf=${csrf}`])
      .set('X-CSRF-Token', csrf)
      .expect(HttpStatus.UNAUTHORIZED);
    const session = await prisma.session.findFirstOrThrow({
      where: { user: { email: payload.email } },
    });
    expect(session.revokedAt).toBeTruthy();
    await request(app.getHttpServer())
      .get('/api/v1/v1/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(HttpStatus.UNAUTHORIZED);
    const secondLogin = await request(app.getHttpServer())
      .post('/api/v1/v1/auth/login')
      .set('Cookie', deviceCookie)
      .send({ email: payload.email, password: payload.password })
      .expect(HttpStatus.OK);
    const secondCookies = secondLogin.headers['set-cookie'] as unknown as string[];
    const secondCsrf = String(secondCookies.find((cookie) => cookie.startsWith('litbuy_csrf')))
      .split(';')[0]
      .split('=')[1];
    await request(app.getHttpServer())
      .post('/api/v1/v1/auth/logout')
      .set('Cookie', secondCookies)
      .set('X-CSRF-Token', secondCsrf)
      .expect(HttpStatus.OK);
    await request(app.getHttpServer())
      .post('/api/v1/v1/auth/refresh')
      .set('Cookie', secondCookies)
      .set('X-CSRF-Token', secondCsrf)
      .expect(HttpStatus.UNAUTHORIZED);
    await expect(prisma.user.count()).resolves.toBe(1);
    await expect(prisma.device.count()).resolves.toBeGreaterThanOrEqual(1);
    await expect(prisma.session.count()).resolves.toBeGreaterThanOrEqual(2);
    await expect(prisma.sessionRefreshToken.count()).resolves.toBeGreaterThanOrEqual(3);
    await expect(prisma.verificationChallenge.count()).resolves.toBeGreaterThanOrEqual(1);
    await expect(prisma.securityEvent.count()).resolves.toBeGreaterThanOrEqual(1);
    const serialized = JSON.stringify({
      users: await prisma.user.findMany(),
      sessions: await prisma.session.findMany(),
      refresh: await prisma.sessionRefreshToken.findMany(),
      challenges: await prisma.verificationChallenge.findMany(),
    });
    expect(serialized).not.toContain(emailToken);
    expect(serialized).not.toContain(oldRefreshCookie);
  });
});
