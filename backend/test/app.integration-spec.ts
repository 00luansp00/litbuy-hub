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
import { AuthMailer, MemoryAuthSmsPort } from '../src/auth/auth.service';

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
  let sms: MemoryAuthSmsPort;
  let redisIsolationProbeHit = false;

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
    sms = app.get(MemoryAuthSmsPort);
  });

  beforeEach(async () => {
    const redisClient = await redis.getClient();
    await redisClient.flushdb();
    mailer.send = AuthMailer.prototype.send.bind(mailer);
    sms.send = MemoryAuthSmsPort.prototype.send.bind(sms);
    await prisma.securityEvent.deleteMany();
    await prisma.sessionRefreshToken.deleteMany();
    await prisma.session.deleteMany();
    await prisma.verificationChallenge.deleteMany();
    await prisma.twoFactorRecoveryCode.deleteMany();
    await prisma.twoFactorSettings.deleteMany();
    await prisma.emailChangeRequest.deleteMany();
    await prisma.device.deleteMany();
    await prisma.passwordCredential.deleteMany();
    await prisma.user.deleteMany();
    mailer.sent.splice(0);
    sms.sent.splice(0);
  });

  afterAll(async () => {
    await app.close();
  });

  async function registerVerifiedAndLogin(email: string, password = 'integration password 123') {
    const payload = {
      email,
      password,
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
    const verifyToken = mailer.sent.find(
      (message) => message.to === email && message.purpose === 'EMAIL_VERIFICATION',
    )?.token;
    await request(app.getHttpServer())
      .post('/api/v1/auth/email/verify')
      .send({ token: verifyToken })
      .expect(HttpStatus.OK);
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Cookie', register.headers['set-cookie'] as unknown as string[])
      .send({ email, password })
      .expect(HttpStatus.OK);
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    return { email, password, register, login, user };
  }

  async function emailChangeTokens(userId: string, newEmail: string) {
    const change = await prisma.emailChangeRequest.findFirstOrThrow({
      where: { userId, completedAt: null, cancelledAt: null },
      orderBy: { createdAt: 'desc' },
    });
    const challenges = await prisma.verificationChallenge.findMany({
      where: { contextId: change.id },
    });
    const currentChallenge = challenges.find(
      (challenge) => challenge.purpose === 'EMAIL_CHANGE_CURRENT',
    )!;
    const newChallenge = challenges.find((challenge) => challenge.purpose === 'EMAIL_CHANGE_NEW')!;
    const currentToken = mailer.sent.find((message) =>
      message.token?.startsWith(`${currentChallenge.id}.`),
    )?.token;
    const newToken = mailer.sent.find((message) =>
      message.token?.startsWith(`${newChallenge.id}.`),
    )?.token;
    expect(currentToken).toEqual(expect.any(String));
    expect(newToken).toEqual(expect.any(String));
    expect(newEmail).toContain('@');
    return {
      change,
      currentChallenge,
      newChallenge,
      currentToken: currentToken!,
      newToken: newToken!,
    };
  }

  it('keeps Swagger disabled when SWAGGER_ENABLED=false', () => {
    const config = app.get(ConfigService);

    expect(config.getOrThrow<AppConfig>('app').swaggerEnabled).toBe(false);
  });

  it('confirms direct real PostgreSQL and Redis connections', async () => {
    await expect(prisma.$queryRaw`SELECT 1`).resolves.toEqual([{ '?column?': 1 }]);
    await expect((await redis.getClient()).ping()).resolves.toBe('PONG');
  });

  it('can hit a real Redis-backed registration rate limit inside one integration test', async () => {
    for (let i = 0; i < 10; i += 1) {
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: `integration-redis-limit-${i}@example.com`,
          password: 'integration password 123',
          birthDate: '2000-01-01',
          termsAccepted: true,
          privacyAccepted: true,
          termsVersion: process.env.CURRENT_TERMS_VERSION,
          privacyVersion: process.env.CURRENT_PRIVACY_VERSION,
        })
        .expect(HttpStatus.CREATED);
    }
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'integration-redis-limit-blocked@example.com',
        password: 'integration password 123',
        birthDate: '2000-01-01',
        termsAccepted: true,
        privacyAccepted: true,
        termsVersion: process.env.CURRENT_TERMS_VERSION,
        privacyVersion: process.env.CURRENT_PRIVACY_VERSION,
      })
      .expect(HttpStatus.TOO_MANY_REQUESTS)
      .expect(({ body }) => expect(body.code).toBe('HTTP_ERROR'));
    redisIsolationProbeHit = true;
  });

  it('starts the next integration test with Redis state flushed by beforeEach', async () => {
    expect(redisIsolationProbeHit).toBe(true);
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'integration-redis-isolation-after-limit@example.com',
        password: 'integration password 123',
        birthDate: '2000-01-01',
        termsAccepted: true,
        privacyAccepted: true,
        termsVersion: process.env.CURRENT_TERMS_VERSION,
        privacyVersion: process.env.CURRENT_PRIVACY_VERSION,
      })
      .expect(HttpStatus.CREATED);
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

  it('executes real Sprint 2C1 email 2FA enrollment, login challenge, recovery code and disable basics', async () => {
    const account = await registerVerifiedAndLogin('integration-2fa-email@example.com');
    const auth = `Bearer ${account.login.body.accessToken}`;
    const deviceCookie = account.register.headers['set-cookie'] as unknown as string[];
    const enrollment = await request(app.getHttpServer())
      .post('/api/v1/auth/2fa/enroll/request')
      .set('Authorization', auth)
      .send({ method: 'EMAIL', currentPassword: account.password })
      .expect(HttpStatus.OK);
    expect(enrollment.body).toHaveProperty('challengeId');
    expect(enrollment.body).not.toHaveProperty('code');
    const enrollmentCode = mailer.sent
      .filter((message) => message.purpose === 'TWO_FACTOR_CODE')
      .at(-1)!.token!;
    const [winner, loser] = await Promise.all([
      request(app.getHttpServer())
        .post('/api/v1/auth/2fa/enroll/confirm')
        .set('Authorization', auth)
        .send({ challengeId: enrollment.body.challengeId, code: enrollmentCode }),
      request(app.getHttpServer())
        .post('/api/v1/auth/2fa/enroll/confirm')
        .set('Authorization', auth)
        .send({ challengeId: enrollment.body.challengeId, code: enrollmentCode }),
    ]);
    expect(
      [winner.status, loser.status].filter((status) => status === Number(HttpStatus.OK)),
    ).toHaveLength(1);
    expect(
      [winner.status, loser.status].every(
        (status) => status !== Number(HttpStatus.INTERNAL_SERVER_ERROR),
      ),
    ).toBe(true);
    const recoveryCodes = (winner.status === Number(HttpStatus.OK) ? winner.body : loser.body)
      .recoveryCodes as string[];
    expect(recoveryCodes).toHaveLength(10);
    const storedRecovery = await prisma.twoFactorRecoveryCode.findMany({
      where: { userId: account.user.id },
    });
    expect(storedRecovery).toHaveLength(10);
    expect(JSON.stringify(storedRecovery)).not.toContain(recoveryCodes[0]);
    await request(app.getHttpServer())
      .get('/api/v1/auth/2fa/status')
      .set('Authorization', auth)
      .expect(HttpStatus.OK)
      .expect(({ body }) => {
        expect(body.enabled).toBe(true);
        expect(body.method).toBe('EMAIL');
        expect(body.recoveryCodesRemaining).toBe(10);
        expect(JSON.stringify(body)).not.toMatch(/hash|pepper|token|phone|email/i);
      });
    const beforeSessions = await prisma.session.count({ where: { userId: account.user.id } });
    const loginChallenge = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Cookie', deviceCookie)
      .send({ email: account.email, password: account.password })
      .expect(HttpStatus.ACCEPTED);
    expect(loginChallenge.body.code).toBe('TWO_FACTOR_REQUIRED');
    await expect(prisma.session.count({ where: { userId: account.user.id } })).resolves.toBe(
      beforeSessions,
    );
    const loginCode = mailer.sent
      .filter((message) => message.purpose === 'TWO_FACTOR_CODE')
      .at(-1)!.token!;
    const [loginWinner, loginLoser] = await Promise.all([
      request(app.getHttpServer())
        .post('/api/v1/auth/2fa/login/verify')
        .set('Cookie', deviceCookie)
        .send({ challengeId: loginChallenge.body.challengeId, code: loginCode }),
      request(app.getHttpServer())
        .post('/api/v1/auth/2fa/login/verify')
        .set('Cookie', deviceCookie)
        .send({ challengeId: loginChallenge.body.challengeId, recoveryCode: recoveryCodes[0] }),
    ]);
    expect(
      [loginWinner.status, loginLoser.status].every(
        (status) => status !== Number(HttpStatus.INTERNAL_SERVER_ERROR),
      ),
    ).toBe(true);
    expect(
      [loginWinner.status, loginLoser.status].filter((status) => status === Number(HttpStatus.OK)),
    ).toHaveLength(1);
    const accessToken = (
      loginWinner.status === Number(HttpStatus.OK) ? loginWinner.body : loginLoser.body
    ).accessToken as string;
    await request(app.getHttpServer())
      .post('/api/v1/auth/2fa/login/verify')
      .set('Cookie', deviceCookie)
      .send({ challengeId: loginChallenge.body.challengeId, recoveryCode: recoveryCodes[0] })
      .expect(HttpStatus.BAD_REQUEST);
    const disable = await request(app.getHttpServer())
      .post('/api/v1/auth/2fa/disable/request')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ currentPassword: account.password })
      .expect((response) =>
        expect([HttpStatus.OK, HttpStatus.UNAUTHORIZED]).toContain(response.status),
      );
    if (disable.status === Number(HttpStatus.OK)) {
      const disableCode = mailer.sent
        .filter((message) => message.purpose === 'TWO_FACTOR_CODE')
        .at(-1)!.token!;
      await request(app.getHttpServer())
        .post('/api/v1/auth/2fa/disable/confirm')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ challengeId: disable.body.challengeId, code: disableCode })
        .expect(HttpStatus.OK);
    }
    await expect(
      prisma.securityEvent.count({
        where: {
          userId: account.user.id,
          eventType: { in: ['TWO_FACTOR_ENABLED', 'TWO_FACTOR_LOGIN_REQUIRED'] },
        },
      }),
    ).resolves.toBeGreaterThanOrEqual(2);
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
    const account = await registerVerifiedAndLogin('integration-concurrent@example.com');

    for (let index = 0; index < 5; index += 1) {
      const login = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .set('Cookie', account.register.headers['set-cookie'] as unknown as string[])
        .send({ email: account.email, password: account.password })
        .expect(HttpStatus.OK);
      const cookies = login.headers['set-cookie'] as unknown as string[];
      const csrf = String(cookies.find((cookie) => cookie.startsWith('litbuy_csrf')))
        .split(';')[0]
        .split('=')[1];
      const sessionId = sessionIdFromAccessToken(login.body.accessToken as string);
      const sessionBefore = await prisma.session.findUniqueOrThrow({ where: { id: sessionId } });

      const [first, second] = await Promise.all([
        request(app.getHttpServer())
          .post('/api/v1/auth/refresh')
          .set('Cookie', cookies)
          .set('X-CSRF-Token', csrf),
        request(app.getHttpServer())
          .post('/api/v1/auth/refresh')
          .set('Cookie', cookies)
          .set('X-CSRF-Token', csrf),
      ]);
      const responses = [first, second];
      const statuses = responses.map((response) => response.status);
      expect(statuses.filter((status) => status === Number(HttpStatus.OK))).toHaveLength(1);
      expect(statuses.filter((status) => status === Number(HttpStatus.UNAUTHORIZED))).toHaveLength(
        1,
      );
      expect(statuses).not.toContain(HttpStatus.INTERNAL_SERVER_ERROR);

      const okResponse = responses.find((response) => response.status === Number(HttpStatus.OK))!;
      await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${okResponse.body.accessToken}`)
        .expect(HttpStatus.UNAUTHORIZED);
      const rotatedCookies = okResponse.headers['set-cookie'] as unknown as string[];
      const rotatedCsrf = String(rotatedCookies.find((cookie) => cookie.startsWith('litbuy_csrf')))
        .split(';')[0]
        .split('=')[1];
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', rotatedCookies)
        .set('X-CSRF-Token', rotatedCsrf)
        .expect(HttpStatus.UNAUTHORIZED);

      const sessionAfter = await prisma.session.findUniqueOrThrow({ where: { id: sessionId } });
      expect(sessionAfter.revokedAt).toEqual(expect.any(Date));
      expect(sessionAfter.revocationReason).toBe('REFRESH_TOKEN_REUSE');
      const family = await prisma.sessionRefreshToken.findMany({
        where: { familyId: sessionBefore.refreshTokenFamilyId },
      });
      expect(family.filter((row) => row.replacedByTokenId !== null)).toHaveLength(1);
      expect(family.filter((row) => row.revokedAt === null)).toHaveLength(0);
      expect(family.filter((row) => row.revokedAt === null && row.usedAt === null)).toHaveLength(0);
      await expect(
        prisma.securityEvent.count({
          where: { sessionId, eventType: 'REFRESH_TOKEN_REUSE_DETECTED' },
        }),
      ).resolves.toBe(1);
      await expect(
        prisma.securityEvent.count({ where: { sessionId, eventType: 'SESSION_REVOKED' } }),
      ).resolves.toBe(1);
    }
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

  it('executes real Sprint 2B2 phone and email change flow with PostgreSQL and Redis', async () => {
    const payload = {
      email: 'integration-sprint-2b2@example.com',
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
    const firstLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Cookie', register.headers['set-cookie'] as unknown as string[])
      .send({ email: payload.email, password: payload.password })
      .expect(HttpStatus.OK);

    const phoneRequest = await request(app.getHttpServer())
      .post('/api/v1/auth/phone/request')
      .set('Authorization', `Bearer ${firstLogin.body.accessToken}`)
      .send({ phone: '(17) 99999-4321', currentPassword: payload.password })
      .expect(HttpStatus.OK);
    const code = sms.sent.find((message) => message.purpose === 'PHONE_VERIFICATION')?.code;
    expect(code).toMatch(/^\d{6}$/);
    await request(app.getHttpServer())
      .post('/api/v1/auth/phone/verify')
      .set('Authorization', `Bearer ${firstLogin.body.accessToken}`)
      .send({ challengeId: phoneRequest.body.challengeId, code, phone: '+55 17 99999-4321' })
      .expect(HttpStatus.OK);
    const userAfterPhone = await prisma.user.findUniqueOrThrow({ where: { email: payload.email } });
    expect(userAfterPhone.phoneE164).toBe('+5517999994321');
    expect(userAfterPhone.sensitiveActionHoldUntil).toEqual(expect.any(Date));
    await expect(
      prisma.session.count({ where: { userId: userAfterPhone.id, revokedAt: null } }),
    ).resolves.toBe(0);
    await expect(
      prisma.sessionRefreshToken.count({
        where: { revokedAt: null, session: { userId: userAfterPhone.id } },
      }),
    ).resolves.toBe(0);
    expect(
      JSON.stringify(
        await prisma.verificationChallenge.findMany({ where: { userId: userAfterPhone.id } }),
      ),
    ).not.toContain(code);

    const loginAfterPhone = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Cookie', register.headers['set-cookie'] as unknown as string[])
      .send({ email: payload.email, password: payload.password })
      .expect(HttpStatus.OK);
    await request(app.getHttpServer())
      .post('/api/v1/auth/email/change/request')
      .set('Authorization', `Bearer ${loginAfterPhone.body.accessToken}`)
      .send({
        newEmail: 'integration-sprint-2b2-new@example.com',
        currentPassword: payload.password,
      })
      .expect(HttpStatus.OK);
    const currentToken = mailer.sent.find(
      (message) => message.purpose === 'EMAIL_CHANGE_CONFIRM_CURRENT',
    )?.token;
    const newToken = mailer.sent.find(
      (message) => message.purpose === 'EMAIL_CHANGE_CONFIRM_NEW',
    )?.token;
    expect(currentToken).toEqual(expect.any(String));
    expect(newToken).toEqual(expect.any(String));
    await request(app.getHttpServer())
      .post('/api/v1/auth/email/change/confirm')
      .send({ token: currentToken, newEmail: 'integration-sprint-2b2-new@example.com' })
      .expect(HttpStatus.OK)
      .expect(({ body }) => expect(body.status).toBe('PENDING'));
    await request(app.getHttpServer())
      .post('/api/v1/auth/email/change/confirm')
      .send({ token: newToken, newEmail: 'integration-sprint-2b2-new@example.com' })
      .expect(HttpStatus.OK)
      .expect(({ body }) => expect(body.status).toBe('COMPLETED'));
    await expect(prisma.user.findUnique({ where: { email: payload.email } })).resolves.toBeNull();
    const userAfterEmail = await prisma.user.findUniqueOrThrow({
      where: { email: 'integration-sprint-2b2-new@example.com' },
    });
    expect(userAfterEmail.emailVerifiedAt).toEqual(expect.any(Date));
    await expect(
      prisma.securityEvent.count({
        where: { userId: userAfterEmail.id, eventType: 'EMAIL_CHANGED' },
      }),
    ).resolves.toBe(1);
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Cookie', register.headers['set-cookie'] as unknown as string[])
      .send({ email: payload.email, password: payload.password })
      .expect(HttpStatus.UNAUTHORIZED);
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Cookie', register.headers['set-cookie'] as unknown as string[])
      .send({ email: 'integration-sprint-2b2-new@example.com', password: payload.password })
      .expect(HttpStatus.OK);
    const serializedChallenges = JSON.stringify(
      await prisma.verificationChallenge.findMany({ where: { userId: userAfterEmail.id } }),
    );
    expect(serializedChallenges).not.toContain(currentToken?.split('.')[1]);
    expect(serializedChallenges).not.toContain(newToken?.split('.')[1]);
  });

  it('serializes real Sprint 2B2 concurrent phone and email operations', async () => {
    const payload = {
      email: 'integration-sprint-2b2-concurrency@example.com',
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
    await request(app.getHttpServer())
      .post('/api/v1/auth/email/verify')
      .send({
        token: mailer.sent.find((message) => message.purpose === 'EMAIL_VERIFICATION')?.token,
      })
      .expect(HttpStatus.OK);
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Cookie', register.headers['set-cookie'] as unknown as string[])
      .send({ email: payload.email, password: payload.password })
      .expect(HttpStatus.OK);
    const auth = `Bearer ${login.body.accessToken}`;
    const [first, second] = await Promise.all([
      request(app.getHttpServer())
        .post('/api/v1/auth/phone/request')
        .set('Authorization', auth)
        .send({ phone: '(17) 98888-1111', currentPassword: payload.password }),
      request(app.getHttpServer())
        .post('/api/v1/auth/phone/request')
        .set('Authorization', auth)
        .send({ phone: '(17) 98888-1111', currentPassword: payload.password }),
    ]);
    expect([first.status, second.status].sort()).toEqual([200, 429]);
    const user = await prisma.user.findUniqueOrThrow({ where: { email: payload.email } });
    await expect(
      prisma.verificationChallenge.count({
        where: { userId: user.id, purpose: 'PHONE_VERIFICATION', consumedAt: null },
      }),
    ).resolves.toBe(1);
    const accepted = first.status === 200 ? first : second;
    const code = sms.sent.at(-1)?.code;
    const [verifyA, verifyB] = await Promise.all([
      request(app.getHttpServer())
        .post('/api/v1/auth/phone/verify')
        .set('Authorization', auth)
        .send({ challengeId: accepted.body.challengeId, code, phone: '(17) 98888-1111' }),
      request(app.getHttpServer())
        .post('/api/v1/auth/phone/verify')
        .set('Authorization', auth)
        .send({ challengeId: accepted.body.challengeId, code, phone: '(17) 98888-1111' }),
    ]);
    expect([verifyA.status, verifyB.status].sort()).toEqual([200, 400]);

    const relogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Cookie', register.headers['set-cookie'] as unknown as string[])
      .send({ email: payload.email, password: payload.password })
      .expect(HttpStatus.OK);
    const [emailReqA, emailReqB] = await Promise.all([
      request(app.getHttpServer())
        .post('/api/v1/auth/email/change/request')
        .set('Authorization', `Bearer ${relogin.body.accessToken}`)
        .send({
          newEmail: 'integration-sprint-2b2-concurrency-new@example.com',
          currentPassword: payload.password,
        }),
      request(app.getHttpServer())
        .post('/api/v1/auth/email/change/request')
        .set('Authorization', `Bearer ${relogin.body.accessToken}`)
        .send({
          newEmail: 'integration-sprint-2b2-concurrency-new@example.com',
          currentPassword: payload.password,
        }),
    ]);
    const emailStatuses = [emailReqA.status, emailReqB.status];
    expect(emailStatuses).toContain(HttpStatus.OK);
    expect(emailStatuses).not.toContain(HttpStatus.INTERNAL_SERVER_ERROR);
    for (const response of [emailReqA, emailReqB]) {
      if (response.status !== Number(HttpStatus.OK)) {
        expect([
          HttpStatus.BAD_REQUEST,
          HttpStatus.CONFLICT,
          HttpStatus.TOO_MANY_REQUESTS,
        ]).toContain(response.status);
        expect(JSON.stringify(response.body)).toMatch(
          /EMAIL_UNAVAILABLE|TRANSACTION_CONFLICT|RATE_LIMITED|HTTP_ERROR|VALIDATION_ERROR/,
        );
        expect(JSON.stringify(response.body)).not.toMatch(
          /P2034|40001|P2002|constraint|SQL|Unique/,
        );
      }
    }
    await expect(
      prisma.emailChangeRequest.count({
        where: { userId: user.id, completedAt: null, cancelledAt: null },
      }),
    ).resolves.toBe(1);
    const pendingChange = await prisma.emailChangeRequest.findFirstOrThrow({
      where: { userId: user.id, completedAt: null, cancelledAt: null },
      orderBy: { createdAt: 'desc' },
    });
    await expect(
      prisma.emailChangeRequest.count({
        where: { userId: user.id, id: { not: pendingChange.id }, cancelledAt: null },
      }),
    ).resolves.toBe(0);
    await expect(
      prisma.verificationChallenge.count({
        where: {
          userId: user.id,
          purpose: { in: ['EMAIL_CHANGE_CURRENT', 'EMAIL_CHANGE_NEW'] },
          OR: [{ contextId: null }, { contextId: { not: pendingChange.id }, consumedAt: null }],
        },
      }),
    ).resolves.toBe(0);
    await expect(
      prisma.securityEvent.count({
        where: { userId: user.id, eventType: 'EMAIL_CHANGED' },
      }),
    ).resolves.toBe(0);
  });

  it('preserves a larger sensitive hold with real PostgreSQL during password change', async () => {
    const payload = {
      email: 'integration-hold-preserve@example.com',
      password: 'integration password 123',
      birthDate: '2000-01-01',
      termsAccepted: true,
      privacyAccepted: true,
      termsVersion: process.env.CURRENT_TERMS_VERSION,
      privacyVersion: process.env.CURRENT_PRIVACY_VERSION,
    };
    const otherPayload = { ...payload, email: 'integration-hold-other@example.com' };
    const register = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(payload)
      .expect(HttpStatus.CREATED);
    await request(app.getHttpServer())
      .post('/api/v1/auth/email/verify')
      .send({
        token: mailer.sent.find((message) => message.purpose === 'EMAIL_VERIFICATION')?.token,
      })
      .expect(HttpStatus.OK);
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Cookie', register.headers['set-cookie'] as unknown as string[])
      .send({ email: payload.email, password: payload.password })
      .expect(HttpStatus.OK);
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(otherPayload)
      .expect(HttpStatus.CREATED);
    const user = await prisma.user.findUniqueOrThrow({ where: { email: payload.email } });
    const other = await prisma.user.findUniqueOrThrow({ where: { email: otherPayload.email } });
    const largerHold = new Date('2030-01-01T00:00:00.000Z');
    await prisma.user.update({
      where: { id: user.id },
      data: { sensitiveActionHoldUntil: largerHold, lastSensitiveChangeAt: null },
    });

    await request(app.getHttpServer())
      .post('/api/v1/auth/password/change')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .send({ currentPassword: payload.password, newPassword: 'integration password 456' })
      .expect(HttpStatus.OK);

    const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    const untouched = await prisma.user.findUniqueOrThrow({ where: { id: other.id } });
    expect(updated.sensitiveActionHoldUntil?.toISOString()).toBe(largerHold.toISOString());
    expect(updated.lastSensitiveChangeAt).toEqual(expect.any(Date));
    expect(untouched.sensitiveActionHoldUntil).toBeNull();
    await expect(
      prisma.securityEvent.count({
        where: { userId: user.id, eventType: 'SENSITIVE_ACTION_HOLD_STARTED' },
      }),
    ).resolves.toBe(1);
  });

  it('handles a real cross-account race for the same phone without loser side effects', async () => {
    const first = await registerVerifiedAndLogin('integration-phone-race-a@example.com');
    const second = await registerVerifiedAndLogin('integration-phone-race-b@example.com');
    const phone = '(17) 96666-1212';
    const target = '+5517966661212';

    const firstReq = await request(app.getHttpServer())
      .post('/api/v1/auth/phone/request')
      .set('Authorization', `Bearer ${first.login.body.accessToken}`)
      .send({ phone, currentPassword: first.password })
      .expect(HttpStatus.OK);
    const firstCode = sms.sent.at(-1)?.code;
    const secondReq = await request(app.getHttpServer())
      .post('/api/v1/auth/phone/request')
      .set('Authorization', `Bearer ${second.login.body.accessToken}`)
      .send({ phone, currentPassword: second.password })
      .expect(HttpStatus.OK);
    const secondCode = sms.sent.at(-1)?.code;

    const [firstVerify, secondVerify] = await Promise.all([
      request(app.getHttpServer())
        .post('/api/v1/auth/phone/verify')
        .set('Authorization', `Bearer ${first.login.body.accessToken}`)
        .send({ challengeId: firstReq.body.challengeId, code: firstCode, phone }),
      request(app.getHttpServer())
        .post('/api/v1/auth/phone/verify')
        .set('Authorization', `Bearer ${second.login.body.accessToken}`)
        .send({ challengeId: secondReq.body.challengeId, code: secondCode, phone }),
    ]);
    expect([firstVerify.status, secondVerify.status].sort()).toEqual([200, 400]);
    const winner = firstVerify.status === 200 ? first : second;
    const loser = firstVerify.status === 200 ? second : first;
    const loserChallengeId =
      firstVerify.status === 200 ? secondReq.body.challengeId : firstReq.body.challengeId;
    const loserCode = firstVerify.status === 200 ? secondCode : firstCode;
    const loserResponse = firstVerify.status === 200 ? secondVerify : firstVerify;
    expect(JSON.stringify(loserResponse.body)).toContain('PHONE_UNAVAILABLE');
    expect(JSON.stringify(loserResponse.body)).not.toMatch(
      /P2002|constraint|SQL|Unique|phoneE164|96666/,
    );

    const winnerUser = await prisma.user.findUniqueOrThrow({ where: { id: winner.user.id } });
    const loserUser = await prisma.user.findUniqueOrThrow({ where: { id: loser.user.id } });
    expect(winnerUser.phoneE164).toBe(target);
    expect(winnerUser.sensitiveActionHoldUntil).toEqual(expect.any(Date));
    expect(loserUser.phoneE164).toBeNull();
    expect(loserUser.sensitiveActionHoldUntil).toBeNull();
    expect(loserUser.lastSensitiveChangeAt).toBeNull();
    await expect(prisma.user.count({ where: { phoneE164: target } })).resolves.toBe(1);
    await expect(
      prisma.session.count({ where: { userId: winner.user.id, revokedAt: null } }),
    ).resolves.toBe(0);
    await expect(
      prisma.session.count({ where: { userId: loser.user.id, revokedAt: null } }),
    ).resolves.toBe(1);
    await expect(
      prisma.sessionRefreshToken.count({
        where: { session: { userId: loser.user.id }, revokedAt: null },
      }),
    ).resolves.toBeGreaterThan(0);
    await expect(
      prisma.securityEvent.count({
        where: { userId: winner.user.id, eventType: { in: ['PHONE_VERIFIED', 'PHONE_CHANGED'] } },
      }),
    ).resolves.toBe(1);
    await expect(
      prisma.securityEvent.count({
        where: {
          userId: loser.user.id,
          eventType: { in: ['PHONE_VERIFIED', 'PHONE_CHANGED', 'SESSION_REVOKED'] },
        },
      }),
    ).resolves.toBe(0);
    const loserChallenge = await prisma.verificationChallenge.findUniqueOrThrow({
      where: { id: loserChallengeId },
    });
    expect(loserChallenge.consumedAt).toEqual(expect.any(Date));
    await request(app.getHttpServer())
      .post('/api/v1/auth/phone/verify')
      .set('Authorization', `Bearer ${loser.login.body.accessToken}`)
      .send({ challengeId: loserChallengeId, code: loserCode, phone })
      .expect(HttpStatus.BAD_REQUEST);
  });

  it('handles a real cross-account race for the same new email without loser side effects', async () => {
    const first = await registerVerifiedAndLogin('integration-email-race-a@example.com');
    const second = await registerVerifiedAndLogin('integration-email-race-b@example.com');
    const newEmail = 'integration-email-race-target@example.com';

    await request(app.getHttpServer())
      .post('/api/v1/auth/email/change/request')
      .set('Authorization', `Bearer ${first.login.body.accessToken}`)
      .send({ newEmail, currentPassword: first.password })
      .expect(HttpStatus.OK);
    const firstTokens = await emailChangeTokens(first.user.id, newEmail);
    await request(app.getHttpServer())
      .post('/api/v1/auth/email/change/request')
      .set('Authorization', `Bearer ${second.login.body.accessToken}`)
      .send({ newEmail, currentPassword: second.password })
      .expect(HttpStatus.OK);
    const secondTokens = await emailChangeTokens(second.user.id, newEmail);

    await request(app.getHttpServer())
      .post('/api/v1/auth/email/change/confirm')
      .send({ token: firstTokens.currentToken, newEmail })
      .expect(HttpStatus.OK);
    await request(app.getHttpServer())
      .post('/api/v1/auth/email/change/confirm')
      .send({ token: secondTokens.currentToken, newEmail })
      .expect(HttpStatus.OK);

    const [firstFinal, secondFinal] = await Promise.all([
      request(app.getHttpServer())
        .post('/api/v1/auth/email/change/confirm')
        .send({ token: firstTokens.newToken, newEmail }),
      request(app.getHttpServer())
        .post('/api/v1/auth/email/change/confirm')
        .send({ token: secondTokens.newToken, newEmail }),
    ]);
    expect([firstFinal.status, secondFinal.status].sort()).toEqual([200, 400]);
    const winner = firstFinal.status === 200 ? first : second;
    const loser = firstFinal.status === 200 ? second : first;
    const loserTokens = firstFinal.status === 200 ? secondTokens : firstTokens;
    const loserResponse = firstFinal.status === 200 ? secondFinal : firstFinal;
    expect(JSON.stringify(loserResponse.body)).toContain('EMAIL_UNAVAILABLE');
    expect(JSON.stringify(loserResponse.body)).not.toMatch(
      /P2002|constraint|SQL|Unique|email_key|integration-email-race-target/,
    );

    await expect(prisma.user.count({ where: { email: newEmail } })).resolves.toBe(1);
    const winnerUser = await prisma.user.findUniqueOrThrow({ where: { id: winner.user.id } });
    const loserUser = await prisma.user.findUniqueOrThrow({ where: { id: loser.user.id } });
    expect(winnerUser.email).toBe(newEmail);
    expect(winnerUser.sensitiveActionHoldUntil).toEqual(expect.any(Date));
    expect(loserUser.email).toBe(loser.email);
    expect(loserUser.sensitiveActionHoldUntil).toBeNull();
    expect(loserUser.lastSensitiveChangeAt).toBeNull();
    const loserChange = await prisma.emailChangeRequest.findUniqueOrThrow({
      where: { id: loserTokens.change.id },
    });
    expect(loserChange.cancelledAt).toEqual(expect.any(Date));
    await expect(
      prisma.verificationChallenge.count({
        where: { contextId: loserChange.id, consumedAt: null },
      }),
    ).resolves.toBe(0);
    await expect(
      prisma.session.count({ where: { userId: winner.user.id, revokedAt: null } }),
    ).resolves.toBe(0);
    await expect(
      prisma.session.count({ where: { userId: loser.user.id, revokedAt: null } }),
    ).resolves.toBe(1);
    await expect(
      prisma.sessionRefreshToken.count({
        where: { session: { userId: loser.user.id }, revokedAt: null },
      }),
    ).resolves.toBeGreaterThan(0);
    await expect(
      prisma.securityEvent.count({ where: { userId: winner.user.id, eventType: 'EMAIL_CHANGED' } }),
    ).resolves.toBe(1);
    await expect(
      prisma.securityEvent.count({
        where: { userId: loser.user.id, eventType: { in: ['EMAIL_CHANGED', 'SESSION_REVOKED'] } },
      }),
    ).resolves.toBe(0);
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Cookie', loser.register.headers['set-cookie'] as unknown as string[])
      .send({ email: loser.email, password: loser.password })
      .expect(HttpStatus.OK);
    await request(app.getHttpServer())
      .post('/api/v1/auth/email/change/confirm')
      .send({ token: loserTokens.newToken, newEmail })
      .expect(HttpStatus.BAD_REQUEST);
  });

  it('serializes duplicate and simultaneous real email confirmations without duplicate effects', async () => {
    const pendingUser = await registerVerifiedAndLogin(
      'integration-email-token-pending@example.com',
    );
    const pendingNewEmail = 'integration-email-token-pending-new@example.com';
    await request(app.getHttpServer())
      .post('/api/v1/auth/email/change/request')
      .set('Authorization', `Bearer ${pendingUser.login.body.accessToken}`)
      .send({ newEmail: pendingNewEmail, currentPassword: pendingUser.password })
      .expect(HttpStatus.OK);
    const pendingTokens = await emailChangeTokens(pendingUser.user.id, pendingNewEmail);
    const [pendingA, pendingB] = await Promise.all([
      request(app.getHttpServer())
        .post('/api/v1/auth/email/change/confirm')
        .send({ token: pendingTokens.currentToken, newEmail: pendingNewEmail }),
      request(app.getHttpServer())
        .post('/api/v1/auth/email/change/confirm')
        .send({ token: pendingTokens.currentToken, newEmail: pendingNewEmail }),
    ]);
    expect([pendingA.status, pendingB.status].sort()).toEqual([200, 400]);
    await expect(
      prisma.securityEvent.count({
        where: { userId: pendingUser.user.id, eventType: 'EMAIL_CHANGED' },
      }),
    ).resolves.toBe(0);
    const consumedCurrent = await prisma.verificationChallenge.findUniqueOrThrow({
      where: { id: pendingTokens.currentChallenge.id },
    });
    expect(consumedCurrent.consumedAt).toEqual(expect.any(Date));

    const finalUser = await registerVerifiedAndLogin('integration-email-token-final@example.com');
    const finalNewEmail = 'integration-email-token-final-new@example.com';
    await request(app.getHttpServer())
      .post('/api/v1/auth/email/change/request')
      .set('Authorization', `Bearer ${finalUser.login.body.accessToken}`)
      .send({ newEmail: finalNewEmail, currentPassword: finalUser.password })
      .expect(HttpStatus.OK);
    const finalTokens = await emailChangeTokens(finalUser.user.id, finalNewEmail);
    await request(app.getHttpServer())
      .post('/api/v1/auth/email/change/confirm')
      .send({ token: finalTokens.currentToken, newEmail: finalNewEmail })
      .expect(HttpStatus.OK);
    const [finalA, finalB] = await Promise.all([
      request(app.getHttpServer())
        .post('/api/v1/auth/email/change/confirm')
        .send({ token: finalTokens.newToken, newEmail: finalNewEmail }),
      request(app.getHttpServer())
        .post('/api/v1/auth/email/change/confirm')
        .send({ token: finalTokens.newToken, newEmail: finalNewEmail }),
    ]);
    expect([finalA.status, finalB.status].sort()).toEqual([200, 400]);
    await expect(prisma.user.count({ where: { email: finalNewEmail } })).resolves.toBe(1);
    await expect(
      prisma.emailChangeRequest.count({
        where: { id: finalTokens.change.id, completedAt: { not: null } },
      }),
    ).resolves.toBe(1);
    await expect(
      prisma.securityEvent.count({
        where: { userId: finalUser.user.id, eventType: 'EMAIL_CHANGED' },
      }),
    ).resolves.toBe(1);

    const simultaneousUser = await registerVerifiedAndLogin(
      'integration-email-token-simultaneous@example.com',
    );
    const simultaneousNewEmail = 'integration-email-token-simultaneous-new@example.com';
    await request(app.getHttpServer())
      .post('/api/v1/auth/email/change/request')
      .set('Authorization', `Bearer ${simultaneousUser.login.body.accessToken}`)
      .send({ newEmail: simultaneousNewEmail, currentPassword: simultaneousUser.password })
      .expect(HttpStatus.OK);
    const simultaneousTokens = await emailChangeTokens(
      simultaneousUser.user.id,
      simultaneousNewEmail,
    );
    const [currentResult, newResult] = await Promise.all([
      request(app.getHttpServer())
        .post('/api/v1/auth/email/change/confirm')
        .send({ token: simultaneousTokens.currentToken, newEmail: simultaneousNewEmail }),
      request(app.getHttpServer())
        .post('/api/v1/auth/email/change/confirm')
        .send({ token: simultaneousTokens.newToken, newEmail: simultaneousNewEmail }),
    ]);
    expect([currentResult.status, newResult.status].every((status) => status !== 500)).toBe(true);
    await expect(prisma.user.count({ where: { email: simultaneousNewEmail } })).resolves.toBe(1);
    await expect(
      prisma.verificationChallenge.count({
        where: { contextId: simultaneousTokens.change.id, consumedAt: null },
      }),
    ).resolves.toBe(0);
    await expect(
      prisma.securityEvent.count({
        where: { userId: simultaneousUser.user.id, eventType: 'EMAIL_CHANGED' },
      }),
    ).resolves.toBe(1);
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Cookie', simultaneousUser.register.headers['set-cookie'] as unknown as string[])
      .send({ email: simultaneousUser.email, password: simultaneousUser.password })
      .expect(HttpStatus.UNAUTHORIZED);
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Cookie', simultaneousUser.register.headers['set-cookie'] as unknown as string[])
      .send({ email: simultaneousNewEmail, password: simultaneousUser.password })
      .expect(HttpStatus.OK);
  });

  it('compensates real delivery failures without reusable challenges or side effects', async () => {
    const phoneUser = await registerVerifiedAndLogin('integration-delivery-phone@example.com');
    const originalSmsSend = sms.send.bind(sms);
    let failSms = true;
    let attemptedCode: string | undefined;
    let attemptedPhone: string | undefined;
    const failingSmsSend: typeof sms.send = (to, purpose, code) => {
      attemptedPhone = to;
      attemptedCode = code;
      if (failSms) {
        failSms = false;
        throw new Error('simulated sms failure');
      }
      originalSmsSend(to, purpose, code);
    };
    sms.send = failingSmsSend;
    const failedSms = await request(app.getHttpServer())
      .post('/api/v1/auth/phone/request')
      .set('Authorization', `Bearer ${phoneUser.login.body.accessToken}`)
      .send({ phone: '(17) 95555-3434', currentPassword: phoneUser.password })
      .expect(HttpStatus.SERVICE_UNAVAILABLE);
    expect(failedSms.body.code).toBe('SMS_DELIVERY_UNAVAILABLE');
    expect(Object.keys(failedSms.body).sort()).toEqual([
      'code',
      'details',
      'message',
      'path',
      'requestId',
      'statusCode',
      'timestamp',
    ]);
    expect(attemptedCode).toMatch(/^[0-9]{6}$/);
    expect(attemptedPhone).toBe('+5517955553434');
    const serializedSmsFailure = JSON.stringify(failedSms.body);
    expect(serializedSmsFailure).not.toContain(attemptedCode);
    expect(serializedSmsFailure).not.toContain(attemptedPhone);
    expect(serializedSmsFailure).not.toContain('(17) 95555-3434');
    expect(serializedSmsFailure).not.toContain('+5517955553434');
    expect(serializedSmsFailure).not.toContain('3434');
    expect(serializedSmsFailure).not.toMatch(
      /tokenHash|targetHash|pepper|P2002|P2034|40001|SQL|constraint|metadata/i,
    );
    await expect(
      prisma.verificationChallenge.count({
        where: { userId: phoneUser.user.id, purpose: 'PHONE_VERIFICATION', consumedAt: null },
      }),
    ).resolves.toBe(0);
    const phoneAfterFailure = await prisma.user.findUniqueOrThrow({
      where: { id: phoneUser.user.id },
    });
    expect(phoneAfterFailure.sensitiveActionHoldUntil).toBeNull();
    await expect(
      prisma.session.count({ where: { userId: phoneUser.user.id, revokedAt: null } }),
    ).resolves.toBe(1);
    await request(app.getHttpServer())
      .post('/api/v1/auth/phone/request')
      .set('Authorization', `Bearer ${phoneUser.login.body.accessToken}`)
      .send({ phone: '(17) 95555-3434', currentPassword: phoneUser.password })
      .expect(HttpStatus.OK);
    sms.send = originalSmsSend;

    const firstEmailUser = await registerVerifiedAndLogin(
      'integration-delivery-email-first@example.com',
    );
    const originalMailSend = mailer.send.bind(mailer);
    const failingFirstMailSend: AuthMailer['send'] = (to, purpose, token) => {
      if (purpose === 'EMAIL_CHANGE_CONFIRM_CURRENT')
        throw new Error('simulated first email failure');
      originalMailSend(to, purpose, token);
    };
    mailer.send = failingFirstMailSend;
    await request(app.getHttpServer())
      .post('/api/v1/auth/email/change/request')
      .set('Authorization', `Bearer ${firstEmailUser.login.body.accessToken}`)
      .send({
        newEmail: 'integration-delivery-email-first-new@example.com',
        currentPassword: firstEmailUser.password,
      })
      .expect(HttpStatus.SERVICE_UNAVAILABLE)
      .expect(({ body }) => expect(body.code).toBe('EMAIL_DELIVERY_UNAVAILABLE'));
    await expect(
      prisma.emailChangeRequest.count({
        where: { userId: firstEmailUser.user.id, cancelledAt: null },
      }),
    ).resolves.toBe(0);
    await expect(
      prisma.verificationChallenge.count({
        where: { userId: firstEmailUser.user.id, consumedAt: null },
      }),
    ).resolves.toBe(0);
    const firstEmailAfter = await prisma.user.findUniqueOrThrow({
      where: { id: firstEmailUser.user.id },
    });
    expect(firstEmailAfter.sensitiveActionHoldUntil).toBeNull();
    await expect(
      prisma.securityEvent.count({
        where: { userId: firstEmailUser.user.id, eventType: 'EMAIL_CHANGED' },
      }),
    ).resolves.toBe(0);
    mailer.send = originalMailSend;

    const secondEmailUser = await registerVerifiedAndLogin(
      'integration-delivery-email-second@example.com',
    );
    let deliveredCurrentToken = '';
    const failingSecondMailSend: AuthMailer['send'] = (to, purpose, token) => {
      if (purpose === 'EMAIL_CHANGE_CONFIRM_NEW') throw new Error('simulated second email failure');
      if (purpose === 'EMAIL_CHANGE_CONFIRM_CURRENT') deliveredCurrentToken = token ?? '';
      originalMailSend(to, purpose, token);
    };
    mailer.send = failingSecondMailSend;
    await request(app.getHttpServer())
      .post('/api/v1/auth/email/change/request')
      .set('Authorization', `Bearer ${secondEmailUser.login.body.accessToken}`)
      .send({
        newEmail: 'integration-delivery-email-second-new@example.com',
        currentPassword: secondEmailUser.password,
      })
      .expect(HttpStatus.SERVICE_UNAVAILABLE)
      .expect(({ body }) => expect(body.code).toBe('EMAIL_DELIVERY_UNAVAILABLE'));
    expect(deliveredCurrentToken).toEqual(expect.any(String));
    const cancelled = await prisma.emailChangeRequest.findFirstOrThrow({
      where: { userId: secondEmailUser.user.id },
    });
    expect(cancelled.cancelledAt).toEqual(expect.any(Date));
    await expect(
      prisma.verificationChallenge.count({ where: { contextId: cancelled.id, consumedAt: null } }),
    ).resolves.toBe(0);
    await request(app.getHttpServer())
      .post('/api/v1/auth/email/change/confirm')
      .send({
        token: deliveredCurrentToken,
        newEmail: 'integration-delivery-email-second-new@example.com',
      })
      .expect(HttpStatus.BAD_REQUEST);
    const secondEmailAfter = await prisma.user.findUniqueOrThrow({
      where: { id: secondEmailUser.user.id },
    });
    expect(secondEmailAfter.sensitiveActionHoldUntil).toBeNull();
    await expect(
      prisma.session.count({ where: { userId: secondEmailUser.user.id, revokedAt: null } }),
    ).resolves.toBe(1);
    await expect(
      prisma.securityEvent.count({
        where: { userId: secondEmailUser.user.id, eventType: 'EMAIL_CHANGED' },
      }),
    ).resolves.toBe(0);
    mailer.send = originalMailSend;
  });
});
