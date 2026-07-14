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

function sessionIdFromAccessToken(accessToken: string): string {
  const payload = JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64url').toString()) as {
    sid: string;
  };
  return payload.sid;
}

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
    await request(app.getHttpServer())
      .post('/api/v1/v1/auth/register')
      .send({})
      .expect(HttpStatus.NOT_FOUND);
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
      .post('/api/v1/auth/register')
      .send(payload)
      .expect(HttpStatus.CREATED);
    expect(register.body).not.toHaveProperty('token');
    const deviceCookie = register.headers['set-cookie'] as unknown as string[];
    const emailToken = mailer.sent.find(
      (message) => message.purpose === 'EMAIL_VERIFICATION',
    )?.token;
    expect(emailToken).toEqual(expect.any(String));
    await request(app.getHttpServer())
      .post('/api/v1/auth/email/verify')
      .send({ token: emailToken })
      .expect(HttpStatus.OK);
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Cookie', deviceCookie)
      .send({ email: payload.email, password: payload.password })
      .expect(HttpStatus.OK);
    expect(login.body.accessToken).toEqual(expect.any(String));
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
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
      .post('/api/v1/auth/refresh')
      .set('Cookie', authCookies)
      .set('X-CSRF-Token', csrf)
      .expect(HttpStatus.OK);
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', [oldRefreshCookie, `litbuy_csrf=${csrf}`])
      .set('X-CSRF-Token', csrf)
      .expect(HttpStatus.UNAUTHORIZED);
    const session = await prisma.session.findFirstOrThrow({
      where: { user: { email: payload.email } },
    });
    expect(session.revokedAt).toBeTruthy();
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(HttpStatus.UNAUTHORIZED);
    const secondLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Cookie', deviceCookie)
      .send({ email: payload.email, password: payload.password })
      .expect(HttpStatus.OK);
    const secondCookies = secondLogin.headers['set-cookie'] as unknown as string[];
    const secondCsrf = String(secondCookies.find((cookie) => cookie.startsWith('litbuy_csrf')))
      .split(';')[0]
      .split('=')[1];
    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Cookie', secondCookies)
      .set('X-CSRF-Token', secondCsrf)
      .expect(HttpStatus.OK);
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
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

  it('handles concurrent refresh attempts for the same token safely with real PostgreSQL and Redis', async () => {
    const payload = {
      email: 'integration-concurrent@example.com',
      password: 'integration password 123',
      birthDate: '2000-01-01',
      termsAccepted: true,
      privacyAccepted: true,
      termsVersion: process.env.CURRENT_TERMS_VERSION,
      privacyVersion: process.env.CURRENT_PRIVACY_VERSION,
    };
    const register = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(payload)
      .expect(HttpStatus.CREATED);
    const deviceCookie = register.headers['set-cookie'] as unknown as string[];
    const token = mailer.sent.find((message) => message.purpose === 'EMAIL_VERIFICATION')?.token;
    await request(app.getHttpServer())
      .post('/api/v1/auth/email/verify')
      .send({ token })
      .expect(HttpStatus.OK);
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Cookie', deviceCookie)
      .send({ email: payload.email, password: payload.password })
      .expect(HttpStatus.OK);
    const cookies = login.headers['set-cookie'] as unknown as string[];
    const csrf = String(cookies.find((cookie) => cookie.startsWith('litbuy_csrf')))
      .split(';')[0]
      .split('=')[1];
    const [first, second] = await Promise.allSettled([
      request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', cookies)
        .set('X-CSRF-Token', csrf),
      request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', cookies)
        .set('X-CSRF-Token', csrf),
    ]);
    const statuses = [first, second].map((result) =>
      result.status === 'fulfilled' ? result.value.status : 500,
    );
    expect(statuses.filter((status) => status === 200)).toHaveLength(1);
    expect(statuses.filter((status) => status === 401)).toHaveLength(1);
    const session = await prisma.session.findFirstOrThrow({
      where: { user: { email: payload.email } },
    });
    const family = await prisma.sessionRefreshToken.findMany({
      where: { familyId: session.refreshTokenFamilyId },
    });
    expect(family.filter((row) => row.replacedByTokenId !== null)).toHaveLength(1);
    expect(family.filter((row) => row.revokedAt === null && row.usedAt === null)).toHaveLength(0);
    expect(session.revokedAt).toBeTruthy();
  });

  it('executes real Sprint 2B1 password recovery, sessions, IDOR, device replacement and logout-all flow', async () => {
    const payload = {
      email: 'integration-sprint-2b1@example.com',
      password: 'integration password 123',
      birthDate: '2000-01-01',
      termsAccepted: true,
      privacyAccepted: true,
      termsVersion: process.env.CURRENT_TERMS_VERSION,
      privacyVersion: process.env.CURRENT_PRIVACY_VERSION,
    };
    const register = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(payload)
      .expect(HttpStatus.CREATED);
    const firstDeviceCookie = register.headers['set-cookie'] as unknown as string[];
    const emailToken = mailer.sent.find(
      (message) => message.purpose === 'EMAIL_VERIFICATION',
    )?.token;
    await request(app.getHttpServer())
      .post('/api/v1/auth/email/verify')
      .send({ token: emailToken })
      .expect(HttpStatus.OK);

    const firstLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Cookie', firstDeviceCookie)
      .send({ email: payload.email, password: payload.password })
      .expect(HttpStatus.OK);
    const firstAuthCookies = firstLogin.headers['set-cookie'] as unknown as string[];
    const firstCsrf = String(firstAuthCookies.find((cookie) => cookie.startsWith('litbuy_csrf')))
      .split(';')[0]
      .split('=')[1];
    const secondLoginBeforeReset = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Cookie', firstDeviceCookie)
      .send({ email: payload.email, password: payload.password })
      .expect(HttpStatus.OK);
    const sessionsBeforeReset = await prisma.session.findMany({
      where: { user: { email: payload.email }, revokedAt: null },
    });
    expect(sessionsBeforeReset).toHaveLength(2);

    await request(app.getHttpServer())
      .post('/api/v1/auth/password/forgot')
      .send({ email: payload.email })
      .expect(HttpStatus.OK);
    const resetToken = mailer.sent.find((message) => message.purpose === 'PASSWORD_RESET')?.token;
    expect(resetToken).toEqual(expect.any(String));
    await request(app.getHttpServer())
      .post('/api/v1/auth/password/reset')
      .send({ token: resetToken, newPassword: 'integration new password 123' })
      .expect(HttpStatus.OK);
    const sessionsAfterReset = await prisma.session.findMany({
      where: { user: { email: payload.email } },
    });
    expect(sessionsAfterReset.every((session) => session.revokedAt)).toBe(true);
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${firstLogin.body.accessToken}`)
      .expect(HttpStatus.UNAUTHORIZED);
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', firstAuthCookies)
      .set('X-CSRF-Token', firstCsrf)
      .expect(HttpStatus.UNAUTHORIZED);
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${secondLoginBeforeReset.body.accessToken}`)
      .expect(HttpStatus.UNAUTHORIZED);
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Cookie', firstDeviceCookie)
      .send({ email: payload.email, password: payload.password })
      .expect(HttpStatus.UNAUTHORIZED);

    const secondAccount = {
      ...payload,
      email: 'integration-sprint-2b1-other@example.com',
      password: 'integration other password 123',
    };
    const otherRegister = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(secondAccount)
      .expect(HttpStatus.CREATED);
    const otherEmailToken = [...mailer.sent]
      .reverse()
      .find((message) => message.purpose === 'EMAIL_VERIFICATION')?.token;
    await request(app.getHttpServer())
      .post('/api/v1/auth/email/verify')
      .send({ token: otherEmailToken })
      .expect(HttpStatus.OK);
    const otherLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Cookie', otherRegister.headers['set-cookie'] as unknown as string[])
      .send({ email: secondAccount.email, password: secondAccount.password })
      .expect(HttpStatus.OK);
    const otherSession = await prisma.session.findFirstOrThrow({
      where: { user: { email: secondAccount.email } },
    });

    const sessionRevocationLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Cookie', firstDeviceCookie)
      .send({ email: payload.email, password: 'integration new password 123' })
      .expect(HttpStatus.OK);
    const sessionToRevokeId = sessionIdFromAccessToken(
      sessionRevocationLogin.body.accessToken as string,
    );
    const currentLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Cookie', firstDeviceCookie)
      .send({ email: payload.email, password: 'integration new password 123' })
      .expect(HttpStatus.OK);
    const currentSessionId = sessionIdFromAccessToken(currentLogin.body.accessToken as string);
    expect(currentSessionId).not.toBe(sessionToRevokeId);
    await request(app.getHttpServer())
      .delete(`/api/v1/auth/sessions/${otherSession.id}`)
      .set('Authorization', `Bearer ${currentLogin.body.accessToken}`)
      .expect(HttpStatus.OK);
    await expect(
      prisma.session.findUniqueOrThrow({ where: { id: otherSession.id } }),
    ).resolves.toMatchObject({
      revokedAt: null,
    });
    await request(app.getHttpServer())
      .delete(`/api/v1/auth/sessions/${sessionToRevokeId}`)
      .set('Authorization', `Bearer ${currentLogin.body.accessToken}`)
      .expect(HttpStatus.OK);
    await expect(
      prisma.session.findUniqueOrThrow({ where: { id: sessionToRevokeId } }),
    ).resolves.toMatchObject({
      revokedAt: expect.any(Date),
    });
    const revokedRefreshTokens = await prisma.sessionRefreshToken.findMany({
      where: { sessionId: sessionToRevokeId },
    });
    expect(revokedRefreshTokens.length).toBeGreaterThan(0);
    expect(revokedRefreshTokens.every((token) => token.revokedAt)).toBe(true);
    await expect(
      prisma.session.findUniqueOrThrow({ where: { id: currentSessionId } }),
    ).resolves.toMatchObject({
      revokedAt: null,
    });
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${currentLogin.body.accessToken}`)
      .expect(HttpStatus.OK);
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${sessionRevocationLogin.body.accessToken}`)
      .expect(HttpStatus.UNAUTHORIZED);

    const deviceToRevoke = await prisma.device.findFirstOrThrow({
      where: { user: { email: payload.email }, status: 'APPROVED' },
    });
    const oldDeviceSessionCountBefore = await prisma.session.count({
      where: { deviceId: deviceToRevoke.id },
    });
    await request(app.getHttpServer())
      .delete(`/api/v1/auth/devices/${deviceToRevoke.id}`)
      .set('Authorization', `Bearer ${currentLogin.body.accessToken}`)
      .expect(HttpStatus.OK);
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Cookie', firstDeviceCookie)
      .send({ email: payload.email, password: 'integration new password 123' })
      .expect(HttpStatus.FORBIDDEN);
    const pendingLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: payload.email, password: 'integration new password 123' })
      .expect(HttpStatus.ACCEPTED);
    const pendingDeviceCookie = pendingLogin.headers['set-cookie'] as unknown as string[];
    const pendingDevice = await prisma.device.findFirstOrThrow({
      where: { user: { email: payload.email }, status: 'PENDING' },
    });
    expect(pendingDevice.id).not.toBe(deviceToRevoke.id);
    const deviceApproval = [...mailer.sent]
      .reverse()
      .find((message) => message.purpose === 'DEVICE_APPROVAL')?.token;
    await request(app.getHttpServer())
      .post('/api/v1/auth/device/approve')
      .send({ token: deviceApproval })
      .expect(HttpStatus.OK);
    await expect(
      prisma.device.findUniqueOrThrow({ where: { id: deviceToRevoke.id } }),
    ).resolves.toMatchObject({
      status: 'REVOKED',
    });
    await expect(
      prisma.device.findUniqueOrThrow({ where: { id: pendingDevice.id } }),
    ).resolves.toMatchObject({
      status: 'APPROVED',
    });
    await expect(prisma.session.count({ where: { deviceId: deviceToRevoke.id } })).resolves.toBe(
      oldDeviceSessionCountBefore,
    );
    const finalLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Cookie', pendingDeviceCookie)
      .send({ email: payload.email, password: 'integration new password 123' })
      .expect(HttpStatus.OK);
    const finalSession = await prisma.session.findFirstOrThrow({
      where: { user: { email: payload.email }, revokedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    expect(finalSession.deviceId).toBe(pendingDevice.id);
    await request(app.getHttpServer())
      .post('/api/v1/auth/sessions/logout-all')
      .set('Authorization', `Bearer ${finalLogin.body.accessToken}`)
      .expect(HttpStatus.OK);
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${otherLogin.body.accessToken}`)
      .expect(HttpStatus.OK);

    const events = await prisma.securityEvent.findMany({
      where: { user: { email: payload.email } },
    });
    expect(events.map((event) => event.eventType)).toEqual(
      expect.arrayContaining([
        'PASSWORD_RESET_REQUESTED',
        'PASSWORD_RESET_COMPLETED',
        'SESSION_REVOKED',
        'DEVICE_REVOKED',
        'LOGOUT_ALL',
      ]),
    );
    const serialized = JSON.stringify({
      challenges: await prisma.verificationChallenge.findMany(),
      sessions: await prisma.session.findMany(),
      refresh: await prisma.sessionRefreshToken.findMany(),
    });
    expect(serialized).not.toContain(resetToken);
    expect(serialized).not.toContain(payload.password);
    expect(serialized).not.toContain('integration new password 123');
  });

  it('revokes the current real session, clears auth cookies, preserves device cookie, and rejects its access token', async () => {
    const payload = {
      email: 'integration-current-session@example.com',
      password: 'integration password 123',
      birthDate: '2000-01-01',
      termsAccepted: true,
      privacyAccepted: true,
      termsVersion: process.env.CURRENT_TERMS_VERSION,
      privacyVersion: process.env.CURRENT_PRIVACY_VERSION,
    };
    const register = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(payload)
      .expect(HttpStatus.CREATED);
    const deviceCookie = register.headers['set-cookie'] as unknown as string[];
    const emailToken = mailer.sent.find(
      (message) => message.purpose === 'EMAIL_VERIFICATION',
    )?.token;
    await request(app.getHttpServer())
      .post('/api/v1/auth/email/verify')
      .send({ token: emailToken })
      .expect(HttpStatus.OK);
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Cookie', deviceCookie)
      .send({ email: payload.email, password: payload.password })
      .expect(HttpStatus.OK);
    const currentSessionId = sessionIdFromAccessToken(login.body.accessToken as string);
    await request(app.getHttpServer())
      .delete(`/api/v1/auth/sessions/${currentSessionId}`)
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(HttpStatus.OK)
      .expect((response) => {
        const cookies = String(response.headers['set-cookie']);
        expect(cookies).toContain('litbuy_refresh=;');
        expect(cookies).toContain('litbuy_csrf=;');
        expect(cookies).not.toContain('litbuy_device=;');
      });
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(HttpStatus.UNAUTHORIZED);
  });

  it('allows only one concurrent real password reset request to consume a token', async () => {
    const payload = {
      email: 'integration-sprint-2b1-concurrent@example.com',
      password: 'integration password 123',
      birthDate: '2000-01-01',
      termsAccepted: true,
      privacyAccepted: true,
      termsVersion: process.env.CURRENT_TERMS_VERSION,
      privacyVersion: process.env.CURRENT_PRIVACY_VERSION,
    };
    const register = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(payload)
      .expect(HttpStatus.CREATED);
    const emailToken = mailer.sent.find(
      (message) => message.purpose === 'EMAIL_VERIFICATION',
    )?.token;
    await request(app.getHttpServer())
      .post('/api/v1/auth/email/verify')
      .send({ token: emailToken })
      .expect(HttpStatus.OK);
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Cookie', register.headers['set-cookie'] as unknown as string[])
      .send({ email: payload.email, password: payload.password })
      .expect(HttpStatus.OK);
    await request(app.getHttpServer())
      .post('/api/v1/auth/password/forgot')
      .send({ email: payload.email })
      .expect(HttpStatus.OK);
    const resetToken = mailer.sent.find((message) => message.purpose === 'PASSWORD_RESET')?.token;
    const [first, second] = await Promise.all([
      request(app.getHttpServer())
        .post('/api/v1/auth/password/reset')
        .send({ token: resetToken, newPassword: 'concurrent password one 123' }),
      request(app.getHttpServer())
        .post('/api/v1/auth/password/reset')
        .send({ token: resetToken, newPassword: 'concurrent password two 123' }),
    ]);
    expect([first.status, second.status].sort()).toEqual([200, 400]);
    const acceptedPassword =
      first.status === 200 ? 'concurrent password one 123' : 'concurrent password two 123';
    const rejectedPassword =
      first.status === 200 ? 'concurrent password two 123' : 'concurrent password one 123';
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Cookie', register.headers['set-cookie'] as unknown as string[])
      .send({ email: payload.email, password: acceptedPassword })
      .expect(HttpStatus.OK);
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Cookie', register.headers['set-cookie'] as unknown as string[])
      .send({ email: payload.email, password: rejectedPassword })
      .expect(HttpStatus.UNAUTHORIZED);
    const challenge = await prisma.verificationChallenge.findFirstOrThrow({
      where: { purpose: 'PASSWORD_RESET', user: { email: payload.email } },
    });
    expect(challenge.consumedAt).toEqual(expect.any(Date));
    await expect(
      prisma.securityEvent.count({
        where: { user: { email: payload.email }, eventType: 'PASSWORD_RESET_COMPLETED' },
      }),
    ).resolves.toBe(1);
  });
});
