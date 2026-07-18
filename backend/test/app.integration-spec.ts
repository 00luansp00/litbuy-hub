import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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

const SENSITIVE_RESPONSE_PROPERTY_NAMES = new Set([
  'codeHash',
  'tokenHash',
  'targetHash',
  'passwordHash',
  'csrfTokenHash',
  'refreshTokenHash',
  'pepper',
  'phoneE164',
  'email',
  'recoveryCode',
  'recoveryCodes',
  'token',
  'code',
]);

function sensitiveResponsePropertyPaths(value: unknown, path = 'body'): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) =>
      sensitiveResponsePropertyPaths(entry, `${path}[${index}]`),
    );
  }
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, entry]) => {
    const nextPath = `${path}.${key}`;
    const current = SENSITIVE_RESPONSE_PROPERTY_NAMES.has(key) ? [nextPath] : [];
    return current.concat(sensitiveResponsePropertyPaths(entry, nextPath));
  });
}

async function redisKeys(redis: RedisService): Promise<string[]> {
  const client = await redis.getClient();
  return client.keys('*');
}

async function cleanAuthIntegrationData(prisma: PrismaService): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.securityEvent.deleteMany();
    await tx.stepUpGrant.deleteMany();
    await tx.sessionRefreshToken.deleteMany();
    await tx.verificationChallenge.deleteMany();
    await tx.emailChangeRequest.deleteMany();
    await tx.twoFactorRecoveryCode.deleteMany();
    await tx.twoFactorSettings.deleteMany();
    await tx.userRoleAssignment.deleteMany();
    await tx.sellerProfile.deleteMany();
    await tx.sellerApplication.deleteMany();
    await tx.session.deleteMany();
    await tx.device.deleteMany();
    await tx.passwordCredential.deleteMany();
    await tx.user.deleteMany();
  });
}

describe('App foundation with real PostgreSQL and Redis (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  let mailer: AuthMailer;
  let sms: MemoryAuthSmsPort;

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
    await cleanAuthIntegrationData(prisma);
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

  async function loginOnNewApprovedDevice(
    email: string,
    password: string,
    options: { completeTwoFactor?: boolean } = {},
  ) {
    const pending = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(HttpStatus.ACCEPTED);
    const approval = [...mailer.sent]
      .reverse()
      .find((message) => message.purpose === 'DEVICE_APPROVAL')?.token;
    expect(approval).toEqual(expect.any(String));
    await request(app.getHttpServer())
      .post('/api/v1/auth/device/approve')
      .send({ token: approval })
      .expect(HttpStatus.OK);
    const cookies = pending.headers['set-cookie'] as unknown as string[];
    const approvedLogin = request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Cookie', cookies)
      .send({ email, password });
    if (!options.completeTwoFactor) {
      const login = await approvedLogin.expect(HttpStatus.OK);
      return { login, cookies };
    }
    const challenge = await approvedLogin.expect(HttpStatus.ACCEPTED);
    expect(challenge.body).toMatchObject({
      code: 'TWO_FACTOR_REQUIRED',
      challengeId: expect.any(String),
    });
    expect(challenge.body.accessToken).toBeUndefined();
    const code = [...mailer.sent]
      .reverse()
      .find((message) => message.purpose === 'TWO_FACTOR_CODE')!.token!;
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/2fa/login/verify')
      .set('Cookie', cookies)
      .send({ challengeId: challenge.body.challengeId, code })
      .expect(HttpStatus.OK);
    return { login, cookies, challenge };
  }

  async function activateEmailTwoFactor(
    email: string,
    password: string,
    auth: string,
  ): Promise<string[]> {
    const enrollment = await request(app.getHttpServer())
      .post('/api/v1/auth/2fa/enroll/request')
      .set('Authorization', auth)
      .send({ method: 'EMAIL', currentPassword: password })
      .expect(HttpStatus.OK);
    const code = [...mailer.sent]
      .reverse()
      .find((message) => message.purpose === 'TWO_FACTOR_CODE')!.token!;
    const confirmed = await request(app.getHttpServer())
      .post('/api/v1/auth/2fa/enroll/confirm')
      .set('Authorization', auth)
      .send({ challengeId: enrollment.body.challengeId, code })
      .expect(HttpStatus.OK);
    expect(email).toContain('@');
    return confirmed.body.recoveryCodes as string[];
  }

  async function completeTwoFactorLogin(email: string, password: string, cookies: string[]) {
    const challenge = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Cookie', cookies)
      .send({ email, password })
      .expect(HttpStatus.ACCEPTED);
    const code = [...mailer.sent]
      .reverse()
      .find((message) => message.purpose === 'TWO_FACTOR_CODE')!.token!;
    return request(app.getHttpServer())
      .post('/api/v1/auth/2fa/login/verify')
      .set('Cookie', cookies)
      .send({ challengeId: challenge.body.challengeId, code })
      .expect(HttpStatus.OK);
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
    await expect(redisKeys(redis)).resolves.toHaveLength(0);
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
      .expect(({ body }) => {
        expect(body.code).toBe('RATE_LIMITED');
        expect(JSON.stringify(body)).not.toMatch(
          /integration-redis-limit|redis|rate-limit|127\.0\.0\.1|::1|SELECT|INSERT|UPDATE|DELETE|Prisma|SQL/i,
        );
      });
    await expect(redisKeys(redis)).resolves.not.toHaveLength(0);
  });

  it('starts each integration test with clean Redis state', async () => {
    await expect(redisKeys(redis)).resolves.toHaveLength(0);
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'integration-redis-isolation-clean@example.com',
        password: 'integration password 123',
        birthDate: '2000-01-01',
        termsAccepted: true,
        privacyAccepted: true,
        termsVersion: process.env.CURRENT_TERMS_VERSION,
        privacyVersion: process.env.CURRENT_PRIVACY_VERSION,
      })
      .expect(HttpStatus.CREATED);
    for (let i = 0; i < 9; i += 1) {
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: `integration-redis-isolation-limit-${i}@example.com`,
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
        email: 'integration-redis-isolation-blocked@example.com',
        password: 'integration password 123',
        birthDate: '2000-01-01',
        termsAccepted: true,
        privacyAccepted: true,
        termsVersion: process.env.CURRENT_TERMS_VERSION,
        privacyVersion: process.env.CURRENT_PRIVACY_VERSION,
      })
      .expect(HttpStatus.TOO_MANY_REQUESTS)
      .expect(({ body }) => expect(body.code).toBe('RATE_LIMITED'));
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
      [winner.status, loser.status].filter((status) => status >= 400 && status < 500),
    ).toHaveLength(1);
    expect([winner.status, loser.status]).not.toContain(
      Number(Number(HttpStatus.INTERNAL_SERVER_ERROR)),
    );
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
        expect(Object.keys(body).sort()).toEqual(
          ['enabled', 'enabledAt', 'method', 'recoveryCodesRemaining'].sort(),
        );
        expect(body.enabled).toBe(true);
        expect(body.method).toBe('EMAIL');
        expect(new Date(body.enabledAt).toString()).not.toBe('Invalid Date');
        expect(body.recoveryCodesRemaining).toBe(10);
        expect(sensitiveResponsePropertyPaths(body)).toEqual([]);
      });
    const existingSessions = await prisma.session.findMany({
      where: { userId: account.user.id },
      select: { id: true },
    });
    const existingSessionIds = new Set(existingSessions.map((session) => session.id));
    const beforeSessions = existingSessions.length;
    const beforeRefreshTokens = await prisma.sessionRefreshToken.count({
      where: { session: { userId: account.user.id } },
    });
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
      [loginWinner.status, loginLoser.status].filter((status) => status === Number(HttpStatus.OK)),
    ).toHaveLength(1);
    expect(
      [loginWinner.status, loginLoser.status].filter((status) => status >= 400 && status < 500),
    ).toHaveLength(1);
    expect([loginWinner.status, loginLoser.status]).not.toContain(
      Number(Number(HttpStatus.INTERNAL_SERVER_ERROR)),
    );
    await expect(prisma.session.count({ where: { userId: account.user.id } })).resolves.toBe(
      beforeSessions + 1,
    );
    await expect(
      prisma.sessionRefreshToken.count({ where: { session: { userId: account.user.id } } }),
    ).resolves.toBe(beforeRefreshTokens + 1);
    const accessToken = (
      loginWinner.status === Number(HttpStatus.OK) ? loginWinner.body : loginLoser.body
    ).accessToken as string;
    const winningSessionId = sessionIdFromAccessToken(accessToken);
    expect(existingSessionIds.has(winningSessionId)).toBe(false);
    const winningRefreshTokens = await prisma.sessionRefreshToken.findMany({
      where: { sessionId: winningSessionId },
    });
    expect(winningRefreshTokens).toHaveLength(1);
    expect(winningRefreshTokens[0].revokedAt).toBeNull();
    expect(winningRefreshTokens[0].usedAt).toBeNull();
    await expect(prisma.session.count({ where: { userId: account.user.id } })).resolves.toBe(
      beforeSessions + 1,
    );
    await expect(
      prisma.sessionRefreshToken.count({ where: { session: { userId: account.user.id } } }),
    ).resolves.toBe(beforeRefreshTokens + 1);
    await request(app.getHttpServer())
      .post('/api/v1/auth/2fa/login/verify')
      .set('Cookie', deviceCookie)
      .send({ challengeId: loginChallenge.body.challengeId, recoveryCode: recoveryCodes[0] })
      .expect(HttpStatus.BAD_REQUEST);
    const disable = await request(app.getHttpServer())
      .post('/api/v1/auth/2fa/disable/request')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ currentPassword: account.password })
      .expect(HttpStatus.OK);
    {
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

  it('serializes cross-device 2FA enrollment requests with one active challenge per user', async () => {
    const account = await registerVerifiedAndLogin('integration-2fa-cross-device@example.com');
    const authA = `Bearer ${account.login.body.accessToken}`;
    const deviceB = await loginOnNewApprovedDevice(account.email, account.password);
    const authB = `Bearer ${deviceB.login.body.accessToken}`;

    const enrollmentA = await request(app.getHttpServer())
      .post('/api/v1/auth/2fa/enroll/request')
      .set('Authorization', authA)
      .send({ method: 'EMAIL', currentPassword: account.password })
      .expect(HttpStatus.OK);
    const codeA = [...mailer.sent]
      .reverse()
      .find((message) => message.purpose === 'TWO_FACTOR_CODE')!.token!;
    const enrollmentB = await request(app.getHttpServer())
      .post('/api/v1/auth/2fa/enroll/request')
      .set('Authorization', authB)
      .send({ method: 'EMAIL', currentPassword: account.password })
      .expect(HttpStatus.OK);
    const codeB = [...mailer.sent]
      .reverse()
      .find((message) => message.purpose === 'TWO_FACTOR_CODE')!.token!;

    await expect(
      prisma.verificationChallenge.count({
        where: { userId: account.user.id, purpose: 'TWO_FACTOR_ENROLLMENT', consumedAt: null },
      }),
    ).resolves.toBe(1);
    const consumedA = await prisma.verificationChallenge.findUniqueOrThrow({
      where: { id: enrollmentA.body.challengeId },
    });
    const activeB = await prisma.verificationChallenge.findUniqueOrThrow({
      where: { id: enrollmentB.body.challengeId },
    });
    expect(consumedA.consumedAt).toEqual(expect.any(Date));
    expect(activeB.consumedAt).toBeNull();
    expect(activeB.deviceId).not.toBe(consumedA.deviceId);
    await request(app.getHttpServer())
      .post('/api/v1/auth/2fa/enroll/confirm')
      .set('Authorization', authA)
      .send({ challengeId: enrollmentA.body.challengeId, code: codeA })
      .expect(HttpStatus.BAD_REQUEST);
    const confirmed = await request(app.getHttpServer())
      .post('/api/v1/auth/2fa/enroll/confirm')
      .set('Authorization', authB)
      .send({ challengeId: enrollmentB.body.challengeId, code: codeB })
      .expect(HttpStatus.OK);
    expect(confirmed.body.recoveryCodes).toHaveLength(10);

    const concurrent = await registerVerifiedAndLogin(
      'integration-2fa-cross-device-race@example.com',
    );
    const concurrentB = await loginOnNewApprovedDevice(concurrent.email, concurrent.password);
    const [requestA, requestB] = await Promise.all([
      request(app.getHttpServer())
        .post('/api/v1/auth/2fa/enroll/request')
        .set('Authorization', `Bearer ${concurrent.login.body.accessToken}`)
        .send({ method: 'EMAIL', currentPassword: concurrent.password }),
      request(app.getHttpServer())
        .post('/api/v1/auth/2fa/enroll/request')
        .set('Authorization', `Bearer ${concurrentB.login.body.accessToken}`)
        .send({ method: 'EMAIL', currentPassword: concurrent.password }),
    ]);
    const statuses = [requestA.status, requestB.status];
    expect(statuses).not.toContain(Number(Number(HttpStatus.INTERNAL_SERVER_ERROR)));
    expect(statuses.every((status) => [HttpStatus.OK, HttpStatus.CONFLICT].includes(status))).toBe(
      true,
    );
    await expect(
      prisma.verificationChallenge.count({
        where: {
          userId: concurrent.user.id,
          purpose: 'TWO_FACTOR_ENROLLMENT',
          consumedAt: null,
        },
      }),
    ).resolves.toBe(1);
    expect(JSON.stringify([requestA.body, requestB.body])).not.toMatch(/P2002|constraint|SQL/i);
  });

  it('serializes cross-device 2FA disable requests with one active challenge per user', async () => {
    const account = await registerVerifiedAndLogin(
      'integration-2fa-disable-cross-device@example.com',
    );
    const authA = `Bearer ${account.login.body.accessToken}`;
    const deviceB = await loginOnNewApprovedDevice(account.email, account.password);
    await activateEmailTwoFactor(account.email, account.password, authA);
    const loginB = await completeTwoFactorLogin(account.email, account.password, deviceB.cookies);
    const authB = `Bearer ${loginB.body.accessToken}`;

    const disableA = await request(app.getHttpServer())
      .post('/api/v1/auth/2fa/disable/request')
      .set('Authorization', authA)
      .send({ currentPassword: account.password })
      .expect(HttpStatus.OK);
    const disableB = await request(app.getHttpServer())
      .post('/api/v1/auth/2fa/disable/request')
      .set('Authorization', authB)
      .send({ currentPassword: account.password })
      .expect(HttpStatus.OK);
    await expect(
      prisma.verificationChallenge.count({
        where: { userId: account.user.id, purpose: 'TWO_FACTOR_DISABLE', consumedAt: null },
      }),
    ).resolves.toBe(1);
    await expect(
      prisma.verificationChallenge.findUniqueOrThrow({ where: { id: disableA.body.challengeId } }),
    ).resolves.toMatchObject({ consumedAt: expect.any(Date) });
    const activeDisable = await prisma.verificationChallenge.findUniqueOrThrow({
      where: { id: disableB.body.challengeId },
    });
    expect(activeDisable.consumedAt).toBeNull();
    const disableCode = [...mailer.sent]
      .reverse()
      .find((message) => message.purpose === 'TWO_FACTOR_CODE')!.token!;
    await request(app.getHttpServer())
      .post('/api/v1/auth/2fa/disable/confirm')
      .set('Authorization', authA)
      .send({ challengeId: disableA.body.challengeId, code: disableCode })
      .expect(HttpStatus.BAD_REQUEST);
    await request(app.getHttpServer())
      .post('/api/v1/auth/2fa/disable/confirm')
      .set('Authorization', authB)
      .send({ challengeId: disableB.body.challengeId, code: disableCode })
      .expect(HttpStatus.OK);
    await expect(
      prisma.securityEvent.count({
        where: { userId: account.user.id, eventType: 'TWO_FACTOR_DISABLED' },
      }),
    ).resolves.toBe(1);
    await expect(
      prisma.session.count({ where: { userId: account.user.id, revokedAt: null } }),
    ).resolves.toBe(0);
    await expect(
      prisma.sessionRefreshToken.count({
        where: { session: { userId: account.user.id }, revokedAt: null },
      }),
    ).resolves.toBe(0);

    const concurrent = await registerVerifiedAndLogin(
      'integration-2fa-disable-cross-device-race@example.com',
    );
    const concurrentAuthA = `Bearer ${concurrent.login.body.accessToken}`;
    const concurrentB = await loginOnNewApprovedDevice(concurrent.email, concurrent.password);
    await activateEmailTwoFactor(concurrent.email, concurrent.password, concurrentAuthA);
    const concurrentLoginB = await completeTwoFactorLogin(
      concurrent.email,
      concurrent.password,
      concurrentB.cookies,
    );
    const [requestA, requestB] = await Promise.all([
      request(app.getHttpServer())
        .post('/api/v1/auth/2fa/disable/request')
        .set('Authorization', concurrentAuthA)
        .send({ currentPassword: concurrent.password }),
      request(app.getHttpServer())
        .post('/api/v1/auth/2fa/disable/request')
        .set('Authorization', `Bearer ${concurrentLoginB.body.accessToken}`)
        .send({ currentPassword: concurrent.password }),
    ]);
    const statuses = [requestA.status, requestB.status];
    expect(statuses).not.toContain(Number(Number(HttpStatus.INTERNAL_SERVER_ERROR)));
    expect(statuses.every((status) => [HttpStatus.OK, HttpStatus.CONFLICT].includes(status))).toBe(
      true,
    );
    await expect(
      prisma.verificationChallenge.count({
        where: {
          userId: concurrent.user.id,
          purpose: 'TWO_FACTOR_DISABLE',
          consumedAt: null,
        },
      }),
    ).resolves.toBe(1);
    expect(JSON.stringify([requestA.body, requestB.body])).not.toMatch(/P2002|constraint|SQL/i);
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
      expect(statuses).not.toContain(Number(HttpStatus.INTERNAL_SERVER_ERROR));

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
    expect(emailStatuses).not.toContain(Number(HttpStatus.INTERNAL_SERVER_ERROR));
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
    // Same-token duplicate confirmation allows one success; the duplicate is rejected.
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
    // Current/new confirmations are different required tokens; both may succeed, with one finalization.
    expect(currentResult.status).toBe(Number(HttpStatus.OK));
    expect(newResult.status).toBe(Number(HttpStatus.OK));
    expect([currentResult.status, newResult.status]).not.toContain(
      Number(Number(HttpStatus.INTERNAL_SERVER_ERROR)),
    );
    await expect(prisma.user.count({ where: { email: simultaneousNewEmail } })).resolves.toBe(1);
    await expect(prisma.user.count({ where: { id: simultaneousUser.user.id } })).resolves.toBe(1);
    const completedChange = await prisma.emailChangeRequest.findUniqueOrThrow({
      where: { id: simultaneousTokens.change.id },
    });
    expect(completedChange.currentEmailConfirmedAt).toEqual(expect.any(Date));
    expect(completedChange.newEmailConfirmedAt).toEqual(expect.any(Date));
    expect(completedChange.completedAt).toEqual(expect.any(Date));
    await expect(
      prisma.emailChangeRequest.count({
        where: { id: simultaneousTokens.change.id, completedAt: { not: null } },
      }),
    ).resolves.toBe(1);
    const consumedChallenges = await prisma.verificationChallenge.findMany({
      where: { contextId: simultaneousTokens.change.id },
    });
    expect(consumedChallenges).toHaveLength(2);
    expect(consumedChallenges.every((challenge) => challenge.consumedAt)).toBe(true);
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
    await expect(
      prisma.securityEvent.count({
        where: { userId: simultaneousUser.user.id, eventType: 'SENSITIVE_ACTION_HOLD_STARTED' },
      }),
    ).resolves.toBe(1);
    await expect(
      prisma.session.count({ where: { userId: simultaneousUser.user.id, revokedAt: null } }),
    ).resolves.toBe(0);
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
    await request(app.getHttpServer())
      .post('/api/v1/auth/email/change/confirm')
      .send({ token: simultaneousTokens.currentToken, newEmail: simultaneousNewEmail })
      .expect(HttpStatus.BAD_REQUEST);
    await request(app.getHttpServer())
      .post('/api/v1/auth/email/change/confirm')
      .send({ token: simultaneousTokens.newToken, newEmail: simultaneousNewEmail })
      .expect(HttpStatus.BAD_REQUEST);
  });

  it('handles concurrent step-up verify with one grant and one success', async () => {
    const account = await registerVerifiedAndLogin(
      'integration-step-up-verify-concurrent@example.com',
    );
    const auth = `Bearer ${account.login.body.accessToken}`;
    await activateEmailTwoFactor(account.email, account.password, auth);
    const stepUp = await request(app.getHttpServer())
      .post('/api/v1/auth/step-up/request')
      .set('Authorization', auth)
      .send({ scope: 'TWO_FACTOR_METHOD_CHANGE', currentPassword: account.password })
      .expect(HttpStatus.ACCEPTED);
    const code = [...mailer.sent]
      .reverse()
      .find((message) => message.purpose === 'TWO_FACTOR_CODE')!.token!;
    const [first, second] = await Promise.all([
      request(app.getHttpServer())
        .post('/api/v1/auth/step-up/verify')
        .set('Authorization', auth)
        .send({ challengeId: stepUp.body.challengeId, code }),
      request(app.getHttpServer())
        .post('/api/v1/auth/step-up/verify')
        .set('Authorization', auth)
        .send({ challengeId: stepUp.body.challengeId, code }),
    ]);
    const statuses = [first.status, second.status];
    expect(statuses.filter((status) => status === Number(HttpStatus.OK))).toHaveLength(1);
    expect(statuses.filter((status) => status >= 400 && status < 500)).toHaveLength(1);
    expect(statuses).not.toContain(Number(HttpStatus.INTERNAL_SERVER_ERROR));
    await expect(prisma.stepUpGrant.count({ where: { userId: account.user.id } })).resolves.toBe(1);
    await expect(
      prisma.securityEvent.count({
        where: { userId: account.user.id, eventType: 'STEP_UP_SUCCEEDED' },
      }),
    ).resolves.toBe(1);
    await expect(
      prisma.verificationChallenge.count({
        where: { id: stepUp.body.challengeId, consumedAt: { not: null } },
      }),
    ).resolves.toBe(1);
  });

  it('handles concurrent method change confirmation with one mutation and revocation set', async () => {
    const account = await registerVerifiedAndLogin(
      'integration-method-change-concurrent@example.com',
    );
    const auth = `Bearer ${account.login.body.accessToken}`;
    const currentSessionId = sessionIdFromAccessToken(account.login.body.accessToken as string);
    await activateEmailTwoFactor(account.email, account.password, auth);
    const secondary = await loginOnNewApprovedDevice(account.email, account.password, {
      completeTwoFactor: true,
    });
    const secondarySessionId = sessionIdFromAccessToken(secondary.login.body.accessToken as string);
    expect(secondarySessionId).not.toBe(currentSessionId);
    const [currentSessionBefore, secondarySessionBefore] = await Promise.all([
      prisma.session.findUniqueOrThrow({ where: { id: currentSessionId } }),
      prisma.session.findUniqueOrThrow({ where: { id: secondarySessionId } }),
    ]);
    expect(currentSessionBefore.revokedAt).toBeNull();
    expect(secondarySessionBefore.revokedAt).toBeNull();
    expect(secondarySessionBefore.deviceId).not.toBe(currentSessionBefore.deviceId);
    await expect(
      prisma.sessionRefreshToken.count({
        where: { sessionId: secondarySessionId, revokedAt: null },
      }),
    ).resolves.toBe(1);
    await expect(
      prisma.session.count({ where: { userId: account.user.id, revokedAt: null } }),
    ).resolves.toBe(2);
    await prisma.user.update({
      where: { id: account.user.id },
      data: { phoneE164: '+5517999991234', phoneVerifiedAt: new Date() },
    });
    const stepUp = await request(app.getHttpServer())
      .post('/api/v1/auth/step-up/request')
      .set('Authorization', auth)
      .send({ scope: 'TWO_FACTOR_METHOD_CHANGE', currentPassword: account.password })
      .expect(HttpStatus.ACCEPTED);
    const stepUpCode = [...mailer.sent]
      .reverse()
      .find((message) => message.purpose === 'TWO_FACTOR_CODE')!.token!;
    const grant = await request(app.getHttpServer())
      .post('/api/v1/auth/step-up/verify')
      .set('Authorization', auth)
      .send({ challengeId: stepUp.body.challengeId, code: stepUpCode })
      .expect(HttpStatus.OK);
    const methodChange = await request(app.getHttpServer())
      .post('/api/v1/auth/2fa/method/change/request')
      .set('Authorization', auth)
      .set('X-Step-Up-Token', grant.body.stepUpToken)
      .send({ newMethod: 'SMS' })
      .expect(HttpStatus.OK);
    const smsCode = [...sms.sent]
      .reverse()
      .find((message) => message.purpose === 'TWO_FACTOR_CODE')!.code!;
    const [first, second] = await Promise.all([
      request(app.getHttpServer())
        .post('/api/v1/auth/2fa/method/change/confirm')
        .set('Authorization', auth)
        .set('X-Step-Up-Token', grant.body.stepUpToken)
        .send({ challengeId: methodChange.body.challengeId, code: smsCode }),
      request(app.getHttpServer())
        .post('/api/v1/auth/2fa/method/change/confirm')
        .set('Authorization', auth)
        .set('X-Step-Up-Token', grant.body.stepUpToken)
        .send({ challengeId: methodChange.body.challengeId, code: smsCode }),
    ]);
    const statuses = [first.status, second.status];
    expect(statuses.filter((status) => status === Number(HttpStatus.OK))).toHaveLength(1);
    expect(statuses.filter((status) => status >= 400 && status < 500)).toHaveLength(1);
    expect(statuses).not.toContain(Number(HttpStatus.INTERNAL_SERVER_ERROR));
    await expect(
      prisma.twoFactorSettings.findUniqueOrThrow({ where: { userId: account.user.id } }),
    ).resolves.toMatchObject({ method: 'SMS' });
    await expect(
      prisma.securityEvent.count({
        where: { userId: account.user.id, eventType: 'TWO_FACTOR_METHOD_CHANGED' },
      }),
    ).resolves.toBe(1);
    await expect(
      prisma.session.findUniqueOrThrow({ where: { id: currentSessionId } }),
    ).resolves.toMatchObject({ revokedAt: null });
    await expect(
      prisma.session.findUniqueOrThrow({ where: { id: secondarySessionId } }),
    ).resolves.toMatchObject({ revokedAt: expect.any(Date) });
    await expect(
      prisma.sessionRefreshToken.count({ where: { sessionId: currentSessionId, revokedAt: null } }),
    ).resolves.toBe(1);
    await expect(
      prisma.sessionRefreshToken.count({
        where: { sessionId: secondarySessionId, revokedAt: { not: null } },
      }),
    ).resolves.toBe(1);
    await expect(
      prisma.securityEvent.count({
        where: { userId: account.user.id, eventType: 'SESSION_REVOKED' },
      }),
    ).resolves.toBe(1);
  });

  it('handles concurrent recovery regeneration with one final active hash set', async () => {
    const account = await registerVerifiedAndLogin('integration-recovery-concurrent@example.com');
    const auth = `Bearer ${account.login.body.accessToken}`;
    const oldCodes = await activateEmailTwoFactor(account.email, account.password, auth);
    const stepUp = await request(app.getHttpServer())
      .post('/api/v1/auth/step-up/request')
      .set('Authorization', auth)
      .send({ scope: 'TWO_FACTOR_RECOVERY_REGENERATE', currentPassword: account.password })
      .expect(HttpStatus.ACCEPTED);
    const code = [...mailer.sent]
      .reverse()
      .find((message) => message.purpose === 'TWO_FACTOR_CODE')!.token!;
    const grant = await request(app.getHttpServer())
      .post('/api/v1/auth/step-up/verify')
      .set('Authorization', auth)
      .send({ challengeId: stepUp.body.challengeId, code })
      .expect(HttpStatus.OK);
    const [first, second] = await Promise.all([
      request(app.getHttpServer())
        .post('/api/v1/auth/2fa/recovery/regenerate')
        .set('Authorization', auth)
        .set('X-Step-Up-Token', grant.body.stepUpToken),
      request(app.getHttpServer())
        .post('/api/v1/auth/2fa/recovery/regenerate')
        .set('Authorization', auth)
        .set('X-Step-Up-Token', grant.body.stepUpToken),
    ]);
    const statuses = [first.status, second.status];
    expect(statuses.filter((status) => status === Number(HttpStatus.OK))).toHaveLength(1);
    expect(statuses.filter((status) => status >= 400 && status < 500)).toHaveLength(1);
    expect(statuses).not.toContain(Number(HttpStatus.INTERNAL_SERVER_ERROR));
    const success = first.status === Number(HttpStatus.OK) ? first : second;
    expect(success.body.recoveryCodes).toHaveLength(10);
    await expect(
      prisma.twoFactorRecoveryCode.count({ where: { userId: account.user.id, usedAt: null } }),
    ).resolves.toBe(10);
    await expect(
      prisma.securityEvent.count({
        where: { userId: account.user.id, eventType: 'TWO_FACTOR_RECOVERY_CODES_REGENERATED' },
      }),
    ).resolves.toBe(1);
    const stored = await prisma.twoFactorRecoveryCode.findMany({
      where: { userId: account.user.id },
    });
    for (const plaintext of [...oldCodes, ...success.body.recoveryCodes]) {
      expect(stored.some((row) => row.codeHash === plaintext)).toBe(false);
    }
  });

  it('compensates real delivery failures without reusable challenges or side effects', async () => {
    const phoneUser = await registerVerifiedAndLogin('integration-delivery-phone@example.com');
    const originalSmsSend = sms.send.bind(sms);
    let failSms = true;
    let attemptedCode: string | undefined;
    let attemptedPhone: string | undefined;
    const failingSmsSend: typeof sms.send = async (to, purpose, code) => {
      attemptedPhone = to;
      attemptedCode = code;
      if (failSms) {
        failSms = false;
        throw new Error('simulated sms failure');
      }
      await originalSmsSend(to, purpose, code);
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
    const failingFirstMailSend: AuthMailer['send'] = async (to, purpose, token) => {
      if (purpose === 'EMAIL_CHANGE_CONFIRM_CURRENT')
        throw new Error('simulated first email failure');
      await originalMailSend(to, purpose, token);
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
    const failingSecondMailSend: AuthMailer['send'] = async (to, purpose, token) => {
      if (purpose === 'EMAIL_CHANGE_CONFIRM_NEW') throw new Error('simulated second email failure');
      if (purpose === 'EMAIL_CHANGE_CONFIRM_CURRENT') deliveredCurrentToken = token ?? '';
      await originalMailSend(to, purpose, token);
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

  it('executes real Sprint 2C2A step-up hardening and management coverage', async () => {
    const account = await registerVerifiedAndLogin('integration-step-up-2c2a@example.com');
    const auth = `Bearer ${account.login.body.accessToken}`;
    const sessionId = sessionIdFromAccessToken(account.login.body.accessToken as string);
    const recoveryCodes = await activateEmailTwoFactor(account.email, account.password, auth);

    const methodStepUp = await request(app.getHttpServer())
      .post('/api/v1/auth/step-up/request')
      .set('Authorization', auth)
      .send({ scope: 'TWO_FACTOR_METHOD_CHANGE', currentPassword: account.password })
      .expect(HttpStatus.ACCEPTED);
    const recoveryStepUp = await request(app.getHttpServer())
      .post('/api/v1/auth/step-up/request')
      .set('Authorization', auth)
      .send({ scope: 'TWO_FACTOR_RECOVERY_REGENERATE', currentPassword: account.password })
      .expect(HttpStatus.ACCEPTED);
    expect(methodStepUp.body.challengeId).not.toBe(recoveryStepUp.body.challengeId);
    await expect(
      prisma.verificationChallenge.count({
        where: { userId: account.user.id, purpose: 'TWO_FACTOR_STEP_UP', consumedAt: null },
      }),
    ).resolves.toBe(2);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(app.getHttpServer())
        .post('/api/v1/auth/step-up/verify')
        .set('Authorization', auth)
        .send({ challengeId: methodStepUp.body.challengeId, code: '000000' })
        .expect(HttpStatus.BAD_REQUEST);
    }
    const locked = await prisma.verificationChallenge.findUniqueOrThrow({
      where: { id: methodStepUp.body.challengeId },
    });
    expect(locked.attempts).toBe(5);
    await expect(
      prisma.securityEvent.count({
        where: { userId: account.user.id, eventType: 'STEP_UP_FAILED' },
      }),
    ).resolves.toBeGreaterThanOrEqual(1);

    const freshMethod = await request(app.getHttpServer())
      .post('/api/v1/auth/step-up/request')
      .set('Authorization', auth)
      .send({ scope: 'TWO_FACTOR_METHOD_CHANGE', currentPassword: account.password })
      .expect(HttpStatus.ACCEPTED);
    const methodCode = [...mailer.sent]
      .reverse()
      .find((message) => message.purpose === 'TWO_FACTOR_CODE')!.token!;
    const methodGrant = await request(app.getHttpServer())
      .post('/api/v1/auth/step-up/verify')
      .set('Authorization', auth)
      .send({ challengeId: freshMethod.body.challengeId, code: methodCode })
      .expect(HttpStatus.OK);
    await expect(prisma.stepUpGrant.count({ where: { userId: account.user.id } })).resolves.toBe(1);
    const storedGrant = await prisma.stepUpGrant.findFirstOrThrow({
      where: { userId: account.user.id },
    });
    expect(storedGrant.tokenHash).not.toContain(methodGrant.body.stepUpToken);
    await request(app.getHttpServer())
      .post('/api/v1/auth/2fa/recovery/regenerate')
      .set('Authorization', auth)
      .set('X-Step-Up-Token', methodGrant.body.stepUpToken)
      .expect(HttpStatus.BAD_REQUEST)
      .expect(({ body }) => expect(body.code).toBe('STEP_UP_SCOPE_MISMATCH'));

    await prisma.user.update({
      where: { id: account.user.id },
      data: { phoneE164: '+5517999991234', phoneVerifiedAt: new Date() },
    });
    const methodChange = await request(app.getHttpServer())
      .post('/api/v1/auth/2fa/method/change/request')
      .set('Authorization', auth)
      .set('X-Step-Up-Token', methodGrant.body.stepUpToken)
      .send({ newMethod: 'SMS' })
      .expect(HttpStatus.OK);
    const smsCode = [...sms.sent]
      .reverse()
      .find((message) => message.purpose === 'TWO_FACTOR_CODE')!.code!;
    await request(app.getHttpServer())
      .post('/api/v1/auth/2fa/method/change/confirm')
      .set('Authorization', auth)
      .set('X-Step-Up-Token', methodGrant.body.stepUpToken)
      .send({ challengeId: methodChange.body.challengeId, code: smsCode })
      .expect(HttpStatus.OK);
    await expect(
      prisma.twoFactorSettings.findUniqueOrThrow({ where: { userId: account.user.id } }),
    ).resolves.toMatchObject({ method: 'SMS' });
    expect(
      mailer.sent.some((message) => message.purpose === 'TWO_FACTOR_METHOD_CHANGED_NOTICE'),
    ).toBe(true);
    await expect(
      prisma.session.findUniqueOrThrow({ where: { id: sessionId } }),
    ).resolves.toMatchObject({
      revokedAt: null,
    });

    const recoveryRequest = await request(app.getHttpServer())
      .post('/api/v1/auth/step-up/request')
      .set('Authorization', auth)
      .send({ scope: 'TWO_FACTOR_RECOVERY_REGENERATE', currentPassword: account.password })
      .expect(HttpStatus.ACCEPTED);
    const recoveryCode = [...sms.sent]
      .reverse()
      .find((message) => message.purpose === 'TWO_FACTOR_CODE')!.code!;
    const recoveryGrant = await request(app.getHttpServer())
      .post('/api/v1/auth/step-up/verify')
      .set('Authorization', auth)
      .send({ challengeId: recoveryRequest.body.challengeId, code: recoveryCode })
      .expect(HttpStatus.OK);
    const regenerated = await request(app.getHttpServer())
      .post('/api/v1/auth/2fa/recovery/regenerate')
      .set('Authorization', auth)
      .set('X-Step-Up-Token', recoveryGrant.body.stepUpToken)
      .expect(HttpStatus.OK);
    expect(regenerated.body.recoveryCodes).toHaveLength(10);
    await expect(
      prisma.twoFactorRecoveryCode.count({ where: { userId: account.user.id, usedAt: null } }),
    ).resolves.toBe(10);
    const serialized = JSON.stringify(
      await prisma.twoFactorRecoveryCode.findMany({ where: { userId: account.user.id } }),
    );
    expect(serialized).not.toContain(regenerated.body.recoveryCodes[0]);
    expect(serialized).not.toContain(recoveryCodes[0]);
    expect(
      mailer.sent.some(
        (message) => message.purpose === 'TWO_FACTOR_RECOVERY_CODES_REGENERATED_NOTICE',
      ),
    ).toBe(true);
    await request(app.getHttpServer())
      .post('/api/v1/auth/2fa/recovery/regenerate')
      .set('Authorization', auth)
      .set('X-Step-Up-Token', recoveryGrant.body.stepUpToken)
      .expect(HttpStatus.BAD_REQUEST);
  });
});

describe('Marketplace RBAC with real PostgreSQL (integration)', () => {
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
      new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }),
    );
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);
    redis = app.get(RedisService);
    mailer = app.get(AuthMailer);
  });

  beforeEach(async () => {
    const redisClient = await redis.getClient();
    await redisClient.flushdb();
    await cleanAuthIntegrationData(prisma);
    mailer.sent.splice(0);
  });

  afterAll(async () => {
    await app.close();
  });

  it('applies the RBAC migration to a pre-RBAC schema and backfills only BUYER', async () => {
    const schema = `rbac_upgrade_${crypto.randomUUID().replaceAll('-', '_')}`;
    const migration = readFileSync(
      join(
        process.cwd(),
        'prisma/migrations/20260718120000_marketplace_rbac_foundation/migration.sql',
      ),
      'utf8',
    );
    try {
      await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
        await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`);
        await tx.$executeRawUnsafe(`CREATE TYPE "SecurityEventType" AS ENUM ('REGISTERED')`);
        await tx.$executeRawUnsafe(`CREATE TABLE "User" ("id" uuid PRIMARY KEY)`);
        const existingUserId = crypto.randomUUID();
        await tx.$executeRawUnsafe(`INSERT INTO "User" ("id") VALUES ('${existingUserId}'::uuid)`);
        for (const statement of migration
          .split(';')
          .map((rawStatement) => rawStatement.trim())
          .filter(Boolean)) {
          await tx.$executeRawUnsafe(`${statement};`);
        }
        const roles = await tx.$queryRawUnsafe<Array<{ role: string }>>(
          `SELECT "role"::text AS role FROM "${schema}"."UserRoleAssignment" WHERE "userId" = '${existingUserId}'::uuid ORDER BY "role"::text`,
        );
        expect(roles.map((row) => row.role)).toEqual(['BUYER']);
        await tx.$executeRawUnsafe(
          `INSERT INTO "${schema}"."UserRoleAssignment" ("userId", "role") VALUES ('${existingUserId}'::uuid, 'BUYER'::"${schema}"."PlatformRole") ON CONFLICT ("userId", "role") DO NOTHING`,
        );
        const roleCounts = await tx.$queryRawUnsafe<Array<{ role: string; count: bigint }>>(
          `SELECT "role"::text AS role, COUNT(*)::bigint AS count FROM "${schema}"."UserRoleAssignment" GROUP BY "role"::text ORDER BY "role"::text`,
        );
        expect(roleCounts).toEqual([{ role: 'BUYER', count: 1n }]);
        const enumRows = await tx.$queryRawUnsafe<Array<{ enumlabel: string }>>(
          `SELECT enumlabel FROM pg_enum WHERE enumtypid = '"${schema}"."PlatformRole"'::regtype ORDER BY enumsortorder`,
        );
        expect(enumRows.map((r) => r.enumlabel)).toEqual(['BUYER', 'SELLER', 'ADMIN']);
      });
    } finally {
      await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    }
  });

  it('enforces composite uniqueness without assigning SELLER or ADMIN implicitly', async () => {
    const user = await prisma.user.create({
      data: {
        email: 'pre-rbac@example.com',
        birthDate: new Date('2000-01-01'),
        status: 'ACTIVE',
        termsVersion: 'test',
        termsAcceptedAt: new Date(),
        privacyVersion: 'test',
        privacyAcceptedAt: new Date(),
        passwordCredential: { create: { passwordHash: 'hash' } },
      },
    });
    await prisma.userRoleAssignment.create({ data: { userId: user.id, role: 'BUYER' } });
    await expect(
      prisma.userRoleAssignment.create({ data: { userId: user.id, role: 'BUYER' } }),
    ).rejects.toThrow();
    expect(
      await prisma.userRoleAssignment.count({
        where: { userId: user.id, role: { in: ['SELLER', 'ADMIN'] } },
      }),
    ).toBe(0);
  });

  it('records granted/unchanged/revoked outcomes and protects the last active admin', async () => {
    const { grantPlatformRole, revokePlatformRole } =
      await import('../src/auth/platform-role-operations');
    const [adminA, adminB] = await Promise.all([
      prisma.user.create({
        data: {
          email: 'admin-a@example.com',
          birthDate: new Date('2000-01-01'),
          status: 'ACTIVE',
          termsVersion: 'test',
          termsAcceptedAt: new Date(),
          privacyVersion: 'test',
          privacyAcceptedAt: new Date(),
          passwordCredential: { create: { passwordHash: 'hash' } },
        },
      }),
      prisma.user.create({
        data: {
          email: 'admin-b@example.com',
          birthDate: new Date('2000-01-01'),
          status: 'ACTIVE',
          termsVersion: 'test',
          termsAcceptedAt: new Date(),
          privacyVersion: 'test',
          privacyAcceptedAt: new Date(),
          passwordCredential: { create: { passwordHash: 'hash' } },
        },
      }),
    ]);
    await expect(
      Promise.all([
        grantPlatformRole(prisma, adminA.id, 'ADMIN', 'test'),
        grantPlatformRole(prisma, adminA.id, 'ADMIN', 'test'),
      ]),
    ).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ result: 'granted' }),
        expect.objectContaining({ result: 'unchanged' }),
      ]),
    );
    await expect(grantPlatformRole(prisma, adminB.id, 'ADMIN', 'test')).resolves.toMatchObject({
      changed: true,
    });
    await expect(revokePlatformRole(prisma, adminA.id, 'ADMIN', 'test')).resolves.toEqual({
      changed: true,
      result: 'revoked',
    });
    await expect(revokePlatformRole(prisma, adminA.id, 'ADMIN', 'test')).resolves.toEqual({
      changed: false,
      result: 'unchanged',
    });
    await expect(revokePlatformRole(prisma, adminB.id, 'ADMIN', 'test')).rejects.toMatchObject({
      code: 'LAST_ACTIVE_ADMIN_REVOKE_BLOCKED',
    });
    const events = await prisma.securityEvent.findMany({
      where: { userId: adminA.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(events.map((event) => (event.metadata as { result: string }).result)).toEqual(
      expect.arrayContaining(['granted', 'unchanged', 'revoked']),
    );
  });

  it('registration creates BUYER and /auth/me returns deterministic roles', async () => {
    const email = 'rbac-register@example.com';
    const password = 'integration password 123';
    const register = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email,
        password,
        birthDate: '2000-01-01',
        termsAccepted: true,
        privacyAccepted: true,
        termsVersion: process.env.CURRENT_TERMS_VERSION,
        privacyVersion: process.env.CURRENT_PRIVACY_VERSION,
      })
      .expect(HttpStatus.CREATED);
    const token = mailer.sent.find(
      (message) => message.to === email && message.purpose === 'EMAIL_VERIFICATION',
    )?.token;
    await request(app.getHttpServer())
      .post('/api/v1/auth/email/verify')
      .send({ token })
      .expect(HttpStatus.OK);
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Cookie', register.headers['set-cookie'] as unknown as string[])
      .send({ email, password })
      .expect(HttpStatus.OK);
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(await prisma.userRoleAssignment.findMany({ where: { userId: user.id } })).toMatchObject([
      { role: 'BUYER' },
    ]);
    await prisma.userRoleAssignment.create({ data: { userId: user.id, role: 'SELLER' } });
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(HttpStatus.OK)
      .expect((r) => expect(r.body.roles).toEqual(['buyer', 'seller']));
  });
});
