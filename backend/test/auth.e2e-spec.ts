import cookieParser from 'cookie-parser';
import { HttpStatus, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { PrismaService } from '../src/database/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthMailer } from '../src/auth/auth.service';
import type { AuthRuntimeConfig } from '../src/auth/auth.types';
import { randomToken } from '../src/auth/auth.utils';

type Row = Record<string, unknown>;
const id = () => crypto.randomUUID();
const now = () => new Date();

function isoDateYearsAgo(years: number, dayOffset = 0): string {
  const today = new Date();
  const utc = new Date(
    Date.UTC(today.getUTCFullYear() - years, today.getUTCMonth(), today.getUTCDate() + dayOffset),
  );
  return utc.toISOString().slice(0, 10);
}
class Delegate<T extends Row> {
  constructor(private rows: T[]) {}
  async create(args: { data: Row; include?: Row }) {
    await Promise.resolve();
    const row = {
      id: id(),
      createdAt: now(),
      updatedAt: now(),
      attempts: 0,
      consumedAt: null,
      revokedAt: null,
      ...args.data,
    } as unknown as T;
    this.rows.push(row);
    return row;
  }
  async findUnique(args: { where: Row; include?: Row }) {
    await Promise.resolve();
    return this.rows.find((r) => Object.entries(args.where).every(([k, v]) => r[k] === v)) ?? null;
  }
  async findUniqueOrThrow(args: { where: Row }) {
    const r = await this.findUnique(args);
    if (!r) throw new Error('not found');
    return r;
  }
  async findFirst(args: { where: Row }) {
    await Promise.resolve();
    return this.rows.find((r) => this.matches(r, args.where)) ?? null;
  }
  async findMany(args: { where?: Row; include?: Row; orderBy?: Row; take?: number } = {}) {
    await Promise.resolve();
    const rows = args.where
      ? this.rows.filter((r) => this.matches(r, args.where!))
      : [...this.rows];
    return args.take ? rows.slice(0, args.take) : rows;
  }
  async update(args: { where: Row; data: Row }) {
    const r = await this.findUnique({ where: args.where });
    if (!r) throw new Error('not found');
    Object.assign(r, this.apply(args.data, r), { updatedAt: now() });
    return r;
  }
  async updateMany(args: { where: Row; data: Row }) {
    await Promise.resolve();
    const rows = this.rows.filter((r) => this.matches(r, args.where));
    rows.forEach((r) => Object.assign(r, this.apply(args.data, r), { updatedAt: now() }));
    return { count: rows.length };
  }
  async deleteMany(args: { where?: Row } = {}) {
    await Promise.resolve();
    const before = this.rows.length;
    if (!args.where) this.rows.splice(0);
    else {
      for (let index = this.rows.length - 1; index >= 0; index -= 1) {
        if (this.matches(this.rows[index], args.where)) this.rows.splice(index, 1);
      }
    }
    return { count: before - this.rows.length };
  }
  async createMany(args: { data: Row[] }) {
    await Promise.resolve();
    for (const data of args.data) await this.create({ data });
    return { count: args.data.length };
  }
  async count(args: { where?: Row } = {}) {
    await Promise.resolve();
    return args.where
      ? this.rows.filter((r) => this.matches(r, args.where!)).length
      : this.rows.length;
  }
  async upsert(args: { where: Row; update: Row; create: Row }) {
    const found = await this.findUnique({ where: args.where });
    if (found) {
      Object.assign(found, this.apply(args.update, found), { updatedAt: now() });
      return found;
    }
    return this.create({ data: args.create });
  }
  all() {
    return this.rows;
  }
  private matches(r: Row, where: Row): boolean {
    return Object.entries(where).every(([k, v]) => {
      if (v && typeof v === 'object' && !(v instanceof Date)) {
        const condition = v as Row;
        if ('not' in condition && r[k] === condition.not) return false;
        if ('in' in condition && !(condition.in as unknown[]).includes(r[k])) return false;
        if ('lt' in condition && !((r[k] as Date | number) < (condition.lt as Date | number)))
          return false;
        if ('gt' in condition && !((r[k] as Date | number) > (condition.gt as Date | number)))
          return false;
        return true;
      }
      if (v === null) return r[k] == null;
      return r[k] === v;
    });
  }
  private apply(data: Row, current: Row = {}): Row {
    const out: Row = {};
    for (const [k, v] of Object.entries(data))
      out[k] =
        v && typeof v === 'object' && 'increment' in v
          ? Number((v as Row).increment) + Number(current[k] ?? 0)
          : v;
    return out;
  }
}
class FakePrisma {
  users: Row[] = [];
  credentials: Row[] = [];
  devices: Row[] = [];
  sessions: Row[] = [];
  refreshTokens: Row[] = [];
  challenges: Row[] = [];
  events: Row[] = [];
  emailChanges: Row[] = [];
  twoFactorSettingsRows: Row[] = [];
  twoFactorRecoveryCodeRows: Row[] = [];
  user = {
    create: async (a: { data: Row }) => {
      await Promise.resolve();
      const u: Row = {
        id: id(),
        email: a.data.email,
        birthDate: a.data.birthDate,
        status: 'PENDING_EMAIL',
        emailVerifiedAt: null,
        phoneVerifiedAt: null,
        termsVersion: a.data.termsVersion,
        termsAcceptedAt: a.data.termsAcceptedAt,
        privacyVersion: a.data.privacyVersion,
        privacyAcceptedAt: a.data.privacyAcceptedAt,
        createdAt: now(),
        updatedAt: now(),
        deletedAt: null,
        sensitiveActionHoldUntil: null,
        lastSensitiveChangeAt: null,
      };
      this.users.push(u);
      const pc = (a.data.passwordCredential as Row).create as Row;
      this.credentials.push({
        userId: u.id,
        passwordHash: pc.passwordHash,
        failedLoginAttempts: 0,
        lockedUntil: null,
        createdAt: now(),
        updatedAt: now(),
      });
      const d = (a.data.devices as Row).create as Row;
      this.devices.push({
        id: id(),
        userId: u.id,
        ...d,
        firstSeenAt: now(),
        lastSeenAt: now(),
        createdAt: now(),
        updatedAt: now(),
        revokedAt: null,
      });
      return u;
    },
    findUnique: async (a: { where: Row; include?: Row }) => {
      await Promise.resolve();
      const u = this.users.find((x) => x.email === a.where.email || x.id === a.where.id);
      if (!u) return null;
      return a.include?.passwordCredential
        ? { ...u, passwordCredential: this.credentials.find((c) => c.userId === u.id) ?? null }
        : u;
    },
    update: async (a: { where: Row; data: Row }) => {
      await Promise.resolve();
      return Object.assign(
        this.users.find((u) => u.id === a.where.id)!,
        a.data,
      );
    },
    findUniqueOrThrow: async (a: { where: Row }) => {
      await Promise.resolve();
      return this.users.find((u) => u.id === a.where.id)!;
    },
    findFirst: async (a: { where: Row }) => {
      await Promise.resolve();
      return (
        this.users.find((u) =>
          Object.entries(a.where).every(([k, v]) => {
            if (v && typeof v === 'object' && 'not' in v) return u[k] !== (v as Row).not;
            return u[k] === v;
          }),
        ) ?? null
      );
    },
  };
  passwordCredential = new Delegate(this.credentials);
  device = new Delegate(this.devices);
  private challengeDelegate = new Delegate(this.challenges);
  verificationChallenge = {
    create: (a: { data: Row }) => this.challengeDelegate.create(a),
    update: (a: { where: Row; data: Row }) => this.challengeDelegate.update(a),
    updateMany: (a: { where: Row; data: Row }) => this.challengeDelegate.updateMany(a),
    findUniqueOrThrow: (a: { where: Row }) => this.challengeDelegate.findUniqueOrThrow(a),
    findMany: (a: { where?: Row; include?: Row; orderBy?: Row; take?: number } = {}) =>
      this.challengeDelegate.findMany(a),
    findUnique: async (a: { where: Row; include?: Row }) => {
      const ch = await this.challengeDelegate.findUnique(a);
      if (!ch || !a.include) return ch;
      return {
        ...ch,
        user: this.users.find((u) => u.id === ch.userId),
        device: this.devices.find((d) => d.id === ch.deviceId),
      };
    },
  };
  securityEvent = new Delegate(this.events);
  emailChangeRequest = new Delegate(this.emailChanges);
  twoFactorSettings = new Delegate(this.twoFactorSettingsRows);
  twoFactorRecoveryCode = new Delegate(this.twoFactorRecoveryCodeRows);
  private refreshDelegate = new Delegate(this.refreshTokens);
  sessionRefreshToken = {
    create: (a: { data: Row }) => this.refreshDelegate.create(a),
    update: (a: { where: Row; data: Row }) => this.refreshDelegate.update(a),
    updateMany: (a: { where: Row; data: Row }) => this.refreshDelegate.updateMany(a),
    findUnique: async (a: { where: Row; include?: Row }) => {
      await Promise.resolve();
      const t = this.refreshTokens.find(
        (x) => x.id === a.where.id || x.tokenHash === a.where.tokenHash,
      );
      if (!t) return null;
      if (a.include) {
        const s = this.sessions.find((session) => session.id === t.sessionId)!;
        return {
          ...t,
          session: {
            ...s,
            user: this.users.find((u) => u.id === s.userId),
            device: this.devices.find((d) => d.id === s.deviceId),
          },
        };
      }
      return t;
    },
  };
  private sessionDelegate = new Delegate(this.sessions);
  session = {
    create: (a: { data: Row }) => this.sessionDelegate.create(a),
    update: (a: { where: Row; data: Row }) => this.sessionDelegate.update(a),
    updateMany: (a: { where: Row; data: Row }) => this.sessionDelegate.updateMany(a),
    findFirst: async (a: { where: Row; include?: Row }) => {
      const row = await this.sessionDelegate.findFirst(a);
      if (!row || !a.include) return row;
      return { ...row, device: this.devices.find((d) => d.id === row.deviceId) };
    },
    findMany: async (a: { where?: Row; include?: Row; orderBy?: Row; take?: number } = {}) => {
      const rows = await this.sessionDelegate.findMany(a);
      return a.include
        ? rows.map((ss) => ({ ...ss, device: this.devices.find((d) => d.id === ss.deviceId) }))
        : rows;
    },
    findUnique: async (a: { where: Row; include?: Row }) => {
      await Promise.resolve();
      const s = this.sessions.find(
        (x) => x.id === a.where.id || x.refreshTokenHash === a.where.refreshTokenHash,
      );
      if (!s) return null;
      if (a.include)
        return {
          ...s,
          user: this.users.find((u) => u.id === s.userId),
          device: this.devices.find((d) => d.id === s.deviceId),
        };
      return s;
    },
  };
  async $transaction<T>(fn: (tx: this) => Promise<T> | T) {
    await Promise.resolve();
    return fn(this);
  }
  async $executeRaw(strings?: TemplateStringsArray, ...values: unknown[]) {
    await Promise.resolve();
    if (String(strings?.[0] ?? '').includes('UPDATE "User"')) {
      const next = values[0] as Date;
      const changedAt = values[2] as Date;
      const userId = values[3] as string;
      const user = this.users.find((u) => u.id === userId);
      if (user) {
        const current = user.sensitiveActionHoldUntil as Date | null | undefined;
        user.sensitiveActionHoldUntil = current && current > next ? current : next;
        user.lastSensitiveChangeAt = changedAt;
      }
    }
    return 1;
  }
  async isHealthy() {
    await Promise.resolve();
    return true;
  }
}
class FakeRedis {
  counts = new Map<string, number>();
  async getClient() {
    await Promise.resolve();
    return {
      incr: async (k: string) => {
        await Promise.resolve();
        const n = (this.counts.get(k) ?? 0) + 1;
        this.counts.set(k, n);
        return n;
      },
      expire: async () => {
        await Promise.resolve();
        return 1;
      },
      set: async (k: string) => {
        await Promise.resolve();
        if (this.counts.has(`set:${k}`)) return null;
        this.counts.set(`set:${k}`, 1);
        return 'OK';
      },
      eval: async (_script: string, _keys: number, key: string) => {
        await Promise.resolve();
        this.counts.delete(`set:${key}`);
        return 1;
      },
      ping: async () => {
        await Promise.resolve();
        return 'PONG';
      },
    };
  }
  async isHealthy() {
    await Promise.resolve();
    return true;
  }
}

describe('Auth HTTP e2e flows', () => {
  let app: INestApplication;
  let prisma: FakePrisma;
  let mailer: AuthMailer;
  let sms: { sent: { to: string; purpose: string; code?: string }[] };
  let jwt: JwtService;
  let authSecret: string;
  const base = {
    email: 'user@example.com',
    password: 'valid password 123',
    birthDate: isoDateYearsAgo(25),
    termsAccepted: true,
    privacyAccepted: true,
    termsVersion: '2026-test',
    privacyVersion: '2026-test',
  };
  beforeEach(async () => {
    prisma = new FakePrisma();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(RedisService)
      .useValue(new FakeRedis())
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.enableVersioning({ type: VersioningType.URI });
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }),
    );
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();
    mailer = app.get(AuthMailer);
    sms = app.get('AuthSmsPort');
    sms.sent.splice(0);
    jwt = app.get(JwtService);
    authSecret = app.get(ConfigService).getOrThrow<AuthRuntimeConfig>('auth').accessSecret;
  });
  afterEach(async () => app.close());
  function register(email = base.email) {
    return request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ ...base, email });
  }
  function verifyLatest() {
    const token = mailer.sent.at(-1)!.token;
    return request(app.getHttpServer()).post('/api/v1/auth/email/verify').send({ token });
  }
  it('executes registration validation scenarios through HTTP', async () => {
    await request(app.getHttpServer()).post('/api/v1/v1/auth/register').send(base).expect(404);
    await register()
      .expect(HttpStatus.CREATED)
      .expect((r: request.Response) => {
        expect(r.body).not.toHaveProperty('passwordHash');
        expect(r.headers['set-cookie']).toBeDefined();
      });
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ ...base, email: 'minor@example.com', birthDate: isoDateYearsAgo(17) })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ ...base, email: 'exact@example.com', birthDate: isoDateYearsAgo(18) })
      .expect(HttpStatus.CREATED);
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ ...base, email: 'before@example.com', birthDate: isoDateYearsAgo(18, 1) })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ ...base, email: 'future@example.com', birthDate: isoDateYearsAgo(-1) })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ ...base, email: 'terms@example.com', termsVersion: 'old' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ ...base, email: 'privacy@example.com', privacyVersion: 'old' })
      .expect(400);
    await register()
      .expect(HttpStatus.CREATED)
      .expect((r: request.Response) => expect(r.body).not.toHaveProperty('tokenHash'));
  });
  it('executes verification challenge scenarios through HTTP', async () => {
    await register();
    const challenge = prisma.challenges[0];
    await request(app.getHttpServer())
      .post('/api/v1/auth/email/verify')
      .send({ token: `${String(challenge.id)}.${randomToken()}` })
      .expect(400);
    expect(challenge.attempts).toBe(1);
    challenge.attempts = 5;
    await request(app.getHttpServer())
      .post('/api/v1/auth/email/verify')
      .send({ token: `${String(challenge.id)}.${randomToken()}` })
      .expect(400);
    challenge.attempts = 0;
    challenge.expiresAt = new Date(Date.now() - 1000);
    await request(app.getHttpServer())
      .post('/api/v1/auth/email/verify')
      .send({ token: mailer.sent[0].token })
      .expect(400);
    challenge.expiresAt = new Date(Date.now() + 100000);
    await verifyLatest().expect(200);
    await request(app.getHttpServer())
      .post('/api/v1/auth/email/verify')
      .send({ token: mailer.sent[0].token })
      .expect(400);
  });
  it('executes login, device, me, refresh and logout scenarios through HTTP', async () => {
    const reg = await register();
    const deviceCookie = reg.headers['set-cookie'];
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Cookie', deviceCookie)
      .send({ email: base.email, password: base.password })
      .expect(403);
    await verifyLatest();
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Cookie', deviceCookie)
      .send({ email: base.email, password: 'wrong password' })
      .expect(401);
    for (let i = 0; i < 5; i++)
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .set('Cookie', deviceCookie)
        .send({ email: base.email, password: 'wrong password' });
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Cookie', deviceCookie)
      .send({ email: base.email, password: base.password })
      .expect(401);
    expect(prisma.events.some((e) => e.eventType === 'LOGIN_FAILED')).toBe(true);
    expect(prisma.events.some((e) => e.eventType === 'LOGIN_LOCKED')).toBe(true);
    prisma.credentials[0].lockedUntil = new Date(Date.now() - 1000);
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Cookie', deviceCookie)
      .send({ email: base.email, password: base.password })
      .expect(200);
    expect(login.body.accessToken).toEqual(expect.any(String));
    expect(prisma.events.some((e) => e.eventType === 'LOGIN_SUCCEEDED' && e.userId)).toBe(true);
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(200)
      .expect((r) =>
        expect(JSON.stringify(r.body)).not.toMatch(/passwordHash|tokenHash|csrfTokenHash|pepper/),
      );
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer invalid')
      .expect(401);
    const expired = await jwt.signAsync(
      { sub: prisma.users[0].id, sid: prisma.sessions[0].id, type: 'access' },
      { secret: authSecret, expiresIn: -1 },
    );
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${expired}`)
      .expect(401);
    const authCookies = login.headers['set-cookie'] as unknown as string[];
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', authCookies)
      .expect(401);
    const csrf = String(authCookies.find((c: string) => c.startsWith('litbuy_csrf')))
      .split(';')[0]
      .split('=')[1];
    const refreshed = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', authCookies)
      .set('X-CSRF-Token', csrf)
      .expect(200);
    expect(refreshed.body.accessToken).toEqual(expect.any(String));
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', authCookies)
      .set('X-CSRF-Token', csrf)
      .expect(401);
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(401);
    expect(
      prisma.events.some(
        (e) => e.eventType === 'REFRESH_TOKEN_REUSE_DETECTED' && e.sessionId && e.deviceId,
      ),
    ).toBe(true);
    expect(prisma.events.some((e) => e.eventType === 'SESSION_REVOKED' && e.sessionId)).toBe(true);
  });
  it('executes unknown/shared/pending device and logout csrf scenarios through HTTP', async () => {
    const a = await register('a@example.com');
    await verifyLatest();
    await register('b@example.com');
    await verifyLatest();
    const firstUserDeviceUserId = prisma.devices[0].userId;
    const sharedCookie = a.headers['set-cookie'];
    const firstUnknown = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Cookie', sharedCookie)
      .send({ email: 'b@example.com', password: base.password })
      .expect(202);
    const pendingCookie = firstUnknown.headers['set-cookie'] as unknown as string[];
    expect(prisma.devices[0].userId).toBe(firstUserDeviceUserId);
    expect(
      prisma.devices.filter(
        (d) =>
          d.userId === prisma.users.find((u) => u.email === 'b@example.com')!.id &&
          d.status === 'PENDING',
      ),
    ).toHaveLength(1);
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Cookie', pendingCookie)
      .send({ email: 'b@example.com', password: base.password })
      .expect(202);
    expect(
      prisma.devices.filter(
        (d) =>
          d.userId === prisma.users.find((u) => u.email === 'b@example.com')!.id &&
          d.status === 'PENDING',
      ),
    ).toHaveLength(1);
    const approve = mailer.sent.at(-1)!.token;
    await request(app.getHttpServer())
      .post('/api/v1/auth/device/approve')
      .send({ token: approve })
      .expect(200);
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Cookie', pendingCookie)
      .send({ email: 'b@example.com', password: base.password })
      .expect(200);
    const cookies = login.headers['set-cookie'] as unknown as string[];
    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Cookie', cookies)
      .expect(401);
    await request(app.getHttpServer()).post('/api/v1/auth/logout').expect(200);
    const csrf = String(cookies.find((c: string) => c.startsWith('litbuy_csrf')))
      .split(';')[0]
      .split('=')[1];
    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Cookie', cookies)
      .set('X-CSRF-Token', 'bad')
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Cookie', cookies)
      .set('X-CSRF-Token', csrf)
      .expect(200);
    expect(prisma.events.some((e) => e.eventType === 'LOGOUT')).toBe(true);
    expect(prisma.events.some((e) => e.eventType === 'SESSION_REVOKED')).toBe(true);
  });

  it('handles Sprint 2B1 password, sessions and devices endpoints safely', async () => {
    const registration = await register().expect(HttpStatus.CREATED);
    await verifyLatest().expect(200);
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Cookie', registration.headers['set-cookie'])
      .send({ email: base.email, password: base.password })
      .expect(200);
    const bearer = `Bearer ${login.body.accessToken}`;
    await request(app.getHttpServer())
      .post('/api/v1/auth/password/forgot')
      .send({ email: base.email })
      .expect(200);
    await request(app.getHttpServer())
      .post('/api/v1/auth/password/forgot')
      .send({ email: 'missing@example.com' })
      .expect(200);
    const resetMail = mailer.sent.find((m) => m.purpose === 'PASSWORD_RESET')!;
    expect(resetMail.token).toBeTruthy();
    await request(app.getHttpServer())
      .get('/api/v1/auth/sessions')
      .set('Authorization', bearer)
      .expect(200)
      .expect((r) =>
        expect(JSON.stringify(r.body)).not.toMatch(
          /refreshTokenHash|csrfTokenHash|tokenHash|pepper/,
        ),
      );
    await request(app.getHttpServer())
      .get('/api/v1/auth/devices')
      .set('Authorization', bearer)
      .expect(200)
      .expect((r) => expect(JSON.stringify(r.body)).not.toMatch(/tokenHash|pepper/));
    await request(app.getHttpServer())
      .post('/api/v1/auth/password/reset')
      .send({ token: resetMail.token, newPassword: base.password })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/auth/password/reset')
      .send({ token: resetMail.token, newPassword: 'new valid password 123' })
      .expect(200);
    expect(prisma.sessions.every((sess) => sess.revokedAt)).toBe(true);
    const changedLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Cookie', registration.headers['set-cookie'])
      .send({ email: base.email, password: 'new valid password 123' })
      .expect(200);
    await request(app.getHttpServer())
      .post('/api/v1/auth/password/change')
      .set('Authorization', `Bearer ${changedLogin.body.accessToken}`)
      .send({ currentPassword: 'new valid password 123', newPassword: 'second valid password 123' })
      .expect(200);
    expect(prisma.events.map((e) => e.eventType)).toEqual(
      expect.arrayContaining([
        'PASSWORD_RESET_REQUESTED',
        'PASSWORD_RESET_COMPLETED',
        'PASSWORD_CHANGED',
      ]),
    );
  });

  it('covers password forgot public parity, rate limiting and reset token error cases', async () => {
    const registration = await register().expect(HttpStatus.CREATED);
    await verifyLatest().expect(200);
    await request(app.getHttpServer())
      .post('/api/v1/auth/password/forgot')
      .send({ email: base.email })
      .expect(200)
      .expect((r) =>
        expect(r.body.message).toBe('Se a conta existir, enviaremos as instruções por e-mail.'),
      );
    await request(app.getHttpServer())
      .post('/api/v1/auth/password/forgot')
      .send({ email: 'nobody@example.com' })
      .expect(200)
      .expect((r) =>
        expect(r.body.message).toBe('Se a conta existir, enviaremos as instruções por e-mail.'),
      );
    for (let i = 0; i < 4; i++) {
      await request(app.getHttpServer())
        .post('/api/v1/auth/password/forgot')
        .send({ email: base.email });
    }
    await request(app.getHttpServer())
      .post('/api/v1/auth/password/forgot')
      .send({ email: base.email })
      .expect((r) => expect([400, 429]).toContain(r.status));

    await request(app.getHttpServer())
      .post('/api/v1/auth/password/reset')
      .send({ token: 'invalid.invalid', newPassword: 'valid new password 123' })
      .expect(400);
    const resetToken = mailer.sent.find((m) => m.purpose === 'PASSWORD_RESET')!.token!;
    prisma.challenges.find((c) => c.purpose === 'PASSWORD_RESET')!.expiresAt = new Date(
      Date.now() - 1000,
    );
    await request(app.getHttpServer())
      .post('/api/v1/auth/password/reset')
      .send({ token: resetToken, newPassword: 'valid new password 123' })
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/v1/auth/password/forgot')
      .send({ email: 'other@example.com' });
    const userChallenge = prisma.challenges.find(
      (c) => c.purpose === 'PASSWORD_RESET' && c.userId === prisma.users[0].id && !c.consumedAt,
    );
    if (userChallenge) userChallenge.attempts = userChallenge.maxAttempts;
    if (userChallenge) {
      const lockedMail = mailer.sent.at(-1)!.token!;
      await request(app.getHttpServer())
        .post('/api/v1/auth/password/reset')
        .send({ token: lockedMail, newPassword: 'valid new password 123' })
        .expect(400);
    }
    expect(registration.headers['set-cookie']).toBeDefined();
  });

  it('covers valid reset, consumed token, old access/refresh rejection and new password login', async () => {
    const registration = await register().expect(HttpStatus.CREATED);
    await verifyLatest().expect(200);
    const firstLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Cookie', registration.headers['set-cookie'])
      .send({ email: base.email, password: base.password })
      .expect(200);
    const cookies = firstLogin.headers['set-cookie'] as unknown as string[];
    const csrf = String(cookies.find((c: string) => c.startsWith('litbuy_csrf')))
      .split(';')[0]
      .split('=')[1];
    await request(app.getHttpServer())
      .post('/api/v1/auth/password/forgot')
      .send({ email: base.email })
      .expect(200);
    const resetToken = mailer.sent.find((m) => m.purpose === 'PASSWORD_RESET')!.token!;
    await request(app.getHttpServer())
      .post('/api/v1/auth/password/reset')
      .send({ token: resetToken, newPassword: base.password })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/auth/password/reset')
      .send({ token: resetToken, newPassword: 'valid reset password 123' })
      .expect(200);
    await request(app.getHttpServer())
      .post('/api/v1/auth/password/reset')
      .send({ token: resetToken, newPassword: 'another valid password 123' })
      .expect(400);
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${firstLogin.body.accessToken}`)
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookies)
      .set('X-CSRF-Token', csrf)
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Cookie', registration.headers['set-cookie'])
      .send({ email: base.email, password: base.password })
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Cookie', registration.headers['set-cookie'])
      .send({ email: base.email, password: 'valid reset password 123' })
      .expect(200);
    expect(prisma.events.filter((e) => e.eventType === 'PASSWORD_RESET_COMPLETED')).toHaveLength(1);
  });

  it('covers authenticated password change failures and session-current revocation', async () => {
    const registration = await register().expect(HttpStatus.CREATED);
    await verifyLatest().expect(200);
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Cookie', registration.headers['set-cookie'])
      .send({ email: base.email, password: base.password })
      .expect(200);
    await request(app.getHttpServer())
      .post('/api/v1/auth/password/change')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .send({ currentPassword: 'wrong password', newPassword: 'valid changed password 123' })
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/auth/password/change')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .send({ currentPassword: base.password, newPassword: base.password })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/auth/password/change')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .send({ currentPassword: base.password, newPassword: 'valid changed password 123' })
      .expect(200)
      .expect((r) => expect(String(r.headers['set-cookie'])).toContain('litbuy_refresh=;'));
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(401);
  });

  it('covers sessions IDOR, idempotency, current-session cookie cleanup and malformed UUIDs', async () => {
    const registration = await register().expect(HttpStatus.CREATED);
    await verifyLatest().expect(200);
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Cookie', registration.headers['set-cookie'])
      .send({ email: base.email, password: base.password })
      .expect(200);
    const otherRegistration = await register('session-owner-2@example.com').expect(
      HttpStatus.CREATED,
    );
    await verifyLatest().expect(200);
    const otherLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Cookie', otherRegistration.headers['set-cookie'])
      .send({ email: 'session-owner-2@example.com', password: base.password })
      .expect(200);
    await request(app.getHttpServer())
      .get('/api/v1/auth/sessions')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(200)
      .expect((r) => expect(JSON.stringify(r.body)).not.toContain('session-owner-2@example.com'));
    await request(app.getHttpServer())
      .delete('/api/v1/auth/sessions/not-a-uuid')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(400);
    const otherSession = prisma.sessions.find(
      (s) => s.userId === prisma.users.find((u) => u.email === 'session-owner-2@example.com')!.id,
    )!;
    await request(app.getHttpServer())
      .delete(`/api/v1/auth/sessions/${String(otherSession.id)}`)
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(200);
    expect(otherSession.revokedAt ?? null).toBeNull();
    const ownSession = prisma.sessions.find((s) => s.id !== otherSession.id)!;
    await request(app.getHttpServer())
      .delete(`/api/v1/auth/sessions/${String(ownSession.id)}`)
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(200)
      .expect((r) => expect(String(r.headers['set-cookie'])).toContain('litbuy_refresh=;'));
    await request(app.getHttpServer())
      .delete(`/api/v1/auth/sessions/${String(ownSession.id)}`)
      .set('Authorization', `Bearer ${otherLogin.body.accessToken}`)
      .expect(200);
  });

  it('covers device listing, revocation, IDOR, malformed UUIDs and revoked-cookie replacement flow', async () => {
    const registration = await register().expect(HttpStatus.CREATED);
    await verifyLatest().expect(200);
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Cookie', registration.headers['set-cookie'])
      .send({ email: base.email, password: base.password })
      .expect(200);
    await request(app.getHttpServer())
      .get('/api/v1/auth/devices')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(200)
      .expect((r) =>
        expect(JSON.stringify(r.body)).not.toMatch(/tokenHash|pepper|refreshTokenHash/),
      );
    await request(app.getHttpServer())
      .delete('/api/v1/auth/devices/not-a-uuid')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(400);
    await register('device-owner-2@example.com').expect(HttpStatus.CREATED);
    await verifyLatest().expect(200);
    const otherDevice = prisma.devices.find(
      (d) => d.userId === prisma.users.find((u) => u.email === 'device-owner-2@example.com')!.id,
    )!;
    await request(app.getHttpServer())
      .delete(`/api/v1/auth/devices/${String(otherDevice.id)}`)
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(200);
    expect(otherDevice.status).toBe('APPROVED');
    const currentDevice = prisma.devices.find((d) => d.userId === prisma.users[0].id)!;
    await request(app.getHttpServer())
      .delete(`/api/v1/auth/devices/${String(currentDevice.id)}`)
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(200)
      .expect((r) => expect(String(r.headers['set-cookie'])).toContain('litbuy_device=;'));
    await request(app.getHttpServer())
      .delete(`/api/v1/auth/devices/${String(currentDevice.id)}`)
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Cookie', registration.headers['set-cookie'])
      .send({ email: base.email, password: base.password })
      .expect(403);
    const pending = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: base.email, password: base.password })
      .expect(202);
    const approval = mailer.sent.at(-1)!.token;
    await request(app.getHttpServer())
      .post('/api/v1/auth/device/approve')
      .send({ token: approval })
      .expect(200);
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Cookie', pending.headers['set-cookie'] as unknown as string[])
      .send({ email: base.email, password: base.password })
      .expect(200);
    expect(prisma.events.map((e) => e.eventType)).toEqual(
      expect.arrayContaining(['DEVICE_REVOKED']),
    );
  });

  async function verifiedLogin(email = base.email) {
    const registration = await register(email).expect(HttpStatus.CREATED);
    await verifyLatest().expect(200);
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Cookie', registration.headers['set-cookie'])
      .send({ email, password: base.password })
      .expect(200);
    (login as request.Response & { deviceCookies?: string[] }).deviceCookies = registration.headers[
      'set-cookie'
    ] as unknown as string[];
    return login;
  }

  it('executes Sprint 2B2 phone verification HTTP scenarios', async () => {
    const login = await verifiedLogin('phone-user@example.com');
    const auth = `Bearer ${login.body.accessToken}`;
    await request(app.getHttpServer())
      .post('/api/v1/auth/phone/request')
      .set('Authorization', auth)
      .send({ phone: '+1 415 555 2671', currentPassword: base.password })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/auth/phone/request')
      .set('Authorization', auth)
      .send({ phone: '(17) 3333-1234', currentPassword: base.password })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/auth/phone/request')
      .set('Authorization', auth)
      .send({ phone: '(17) 99999-1234', currentPassword: 'wrong' })
      .expect(401);
    const requested = await request(app.getHttpServer())
      .post('/api/v1/auth/phone/request')
      .set('Authorization', auth)
      .send({ phone: '(17) 99999-1234', currentPassword: base.password })
      .expect(200);
    expect(requested.body).toMatchObject({ challengeId: expect.any(String) });
    expect(JSON.stringify(requested.body)).not.toMatch(/99999|tokenHash|123456|pepper/);
    expect(sms.sent.at(-1)?.code).toMatch(/^\d{6}$/);
    expect(
      prisma.challenges.filter(
        (c) =>
          c.userId === prisma.users[0].id && c.purpose === 'PHONE_VERIFICATION' && !c.consumedAt,
      ),
    ).toHaveLength(1);
    await request(app.getHttpServer())
      .post('/api/v1/auth/phone/request')
      .set('Authorization', auth)
      .send({ phone: '(17) 99999-1234', currentPassword: base.password })
      .expect((r) => expect([400, 429]).toContain(r.status));
    await request(app.getHttpServer())
      .post('/api/v1/auth/phone/verify')
      .set('Authorization', auth)
      .send({ challengeId: 'not-a-uuid', code: '123456', phone: '(17) 99999-1234' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/auth/phone/verify')
      .set('Authorization', auth)
      .send({
        challengeId: requested.body.challengeId,
        code: '１２３４５６',
        phone: '(17) 99999-1234',
      })
      .expect(400);
    for (let i = 0; i < 5; i++)
      await request(app.getHttpServer())
        .post('/api/v1/auth/phone/verify')
        .set('Authorization', auth)
        .send({ challengeId: requested.body.challengeId, code: '000000', phone: '(17) 99999-1234' })
        .expect(400);
    expect(prisma.challenges.find((c) => c.id === requested.body.challengeId)?.attempts).toBe(5);
    await request(app.getHttpServer())
      .post('/api/v1/auth/phone/verify')
      .set('Authorization', auth)
      .send({
        challengeId: requested.body.challengeId,
        code: sms.sent.at(-1)?.code,
        phone: '(17) 99999-1234',
      })
      .expect(400);
    const login2 = await verifiedLogin('phone-user-2@example.com');
    const auth2 = `Bearer ${login2.body.accessToken}`;
    const ok = await request(app.getHttpServer())
      .post('/api/v1/auth/phone/request')
      .set('Authorization', auth2)
      .send({ phone: '17 98888-1234', currentPassword: base.password })
      .expect(200);
    await request(app.getHttpServer())
      .post('/api/v1/auth/phone/verify')
      .set('Authorization', auth2)
      .send({
        challengeId: ok.body.challengeId,
        code: sms.sent.at(-1)?.code,
        phone: '+55 17 98888-1234',
      })
      .expect(200)
      .expect((r) => {
        const cookies = String(r.headers['set-cookie']);
        expect(cookies).toContain('litbuy_refresh=;');
        expect(cookies).toContain('litbuy_csrf=;');
        expect(cookies).not.toContain('litbuy_device=;');
      });
    const user = prisma.users.find((u) => u.email === 'phone-user-2@example.com')!;
    expect(user.phoneE164).toBe('+5517988881234');
    expect(user.sensitiveActionHoldUntil).toBeInstanceOf(Date);
    expect(prisma.sessions.filter((ss) => ss.userId === user.id).every((ss) => ss.revokedAt)).toBe(
      true,
    );
    expect(mailer.sent.some((m) => m.purpose === 'PHONE_CHANGED_NOTICE')).toBe(true);
  });

  it('executes Sprint 2B2 email change HTTP scenarios', async () => {
    const login = await verifiedLogin('email-change@example.com');
    const auth = `Bearer ${login.body.accessToken}`;
    await request(app.getHttpServer())
      .post('/api/v1/auth/email/change/request')
      .set('Authorization', auth)
      .send({ newEmail: 'new-email@example.com', currentPassword: 'wrong' })
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/auth/email/change/request')
      .set('Authorization', auth)
      .send({ newEmail: 'email-change@example.com', currentPassword: base.password })
      .expect(400);
    const requested = await request(app.getHttpServer())
      .post('/api/v1/auth/email/change/request')
      .set('Authorization', auth)
      .send({ newEmail: 'new-email@example.com', currentPassword: base.password })
      .expect(200);
    expect(requested.body).toMatchObject({ requestId: expect.any(String) });
    const currentToken = mailer.sent.find(
      (m) => m.purpose === 'EMAIL_CHANGE_CONFIRM_CURRENT',
    )!.token!;
    const newToken = mailer.sent.find((m) => m.purpose === 'EMAIL_CHANGE_CONFIRM_NEW')!.token!;
    expect(currentToken).not.toBe(newToken);
    expect(JSON.stringify(prisma.emailChanges)).not.toContain('new-email@example.com');
    await request(app.getHttpServer())
      .post('/api/v1/auth/email/change/confirm')
      .send({
        token: `${currentToken.split('.')[0]}.${randomToken()}`,
        newEmail: 'new-email@example.com',
      })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/auth/email/change/confirm')
      .send({ token: currentToken, newEmail: 'other-target@example.com' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/auth/email/change/confirm')
      .send({ token: currentToken, newEmail: 'new-email@example.com' })
      .expect(200)
      .expect((r) => expect(r.body.status).toBe('PENDING'));
    await request(app.getHttpServer())
      .post('/api/v1/auth/email/change/confirm')
      .send({ token: currentToken, newEmail: 'new-email@example.com' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/auth/email/change/confirm')
      .send({ token: newToken, newEmail: 'new-email@example.com' })
      .expect(200)
      .expect((r) => {
        expect(r.body.status).toBe('COMPLETED');
        expect(String(r.headers['set-cookie'])).toContain('litbuy_refresh=;');
      });
    const user = prisma.users.find((u) => u.email === 'new-email@example.com')!;
    expect(user).toBeDefined();
    expect(user.sensitiveActionHoldUntil).toBeInstanceOf(Date);
    expect(prisma.events.filter((e) => e.eventType === 'EMAIL_CHANGED')).toHaveLength(1);
    expect(prisma.sessions.filter((ss) => ss.userId === user.id).every((ss) => ss.revokedAt)).toBe(
      true,
    );
    expect(JSON.stringify(prisma.challenges)).not.toContain(newToken.split('.')[1]);
  });

  it('invalidates phone challenge and releases cooldown when SMS delivery fails', async () => {
    const login = await verifiedLogin('sms-failure@example.com');
    const auth = `Bearer ${login.body.accessToken}`;
    const originalSend = (sms as { send?: (...args: unknown[]) => void }).send;
    (sms as { send?: (...args: unknown[]) => void }).send = () => {
      throw new Error('simulated sms outage');
    };
    await request(app.getHttpServer())
      .post('/api/v1/auth/phone/request')
      .set('Authorization', auth)
      .send({ phone: '(17) 97777-1234', currentPassword: base.password })
      .expect(503)
      .expect((r) => expect(r.body.code).toBe('SMS_DELIVERY_UNAVAILABLE'));
    expect(
      prisma.challenges.filter((c) => c.purpose === 'PHONE_VERIFICATION' && !c.consumedAt),
    ).toHaveLength(0);
    (sms as { send?: (...args: unknown[]) => void }).send = originalSend;
    await request(app.getHttpServer())
      .post('/api/v1/auth/phone/request')
      .set('Authorization', auth)
      .send({ phone: '(17) 97777-1234', currentPassword: base.password })
      .expect(200);
  });

  it('cancels email change and invalidates delivered token when essential email delivery fails', async () => {
    const login = await verifiedLogin('email-delivery-failure@example.com');
    const auth = `Bearer ${login.body.accessToken}`;
    const originalSend = mailer.send.bind(mailer);
    let sends = 0;
    const failingSend: AuthMailer['send'] = (to, purpose, token) => {
      sends += 1;
      if (purpose === 'EMAIL_CHANGE_CONFIRM_NEW') throw new Error('simulated email outage');
      originalSend(to, purpose, token);
    };
    mailer.send = failingSend;
    await request(app.getHttpServer())
      .post('/api/v1/auth/email/change/request')
      .set('Authorization', auth)
      .send({ newEmail: 'email-delivery-new@example.com', currentPassword: base.password })
      .expect(503)
      .expect((r) => expect(r.body.code).toBe('EMAIL_DELIVERY_UNAVAILABLE'));
    expect(sends).toBeGreaterThanOrEqual(2);
    const deliveredToken = mailer.sent.find(
      (m) => m.purpose === 'EMAIL_CHANGE_CONFIRM_CURRENT',
    )!.token!;
    expect(prisma.emailChanges.filter((change) => !change.cancelledAt)).toHaveLength(0);
    expect(prisma.challenges.filter((challenge) => !challenge.consumedAt)).toHaveLength(0);
    mailer.send = originalSend;
    await request(app.getHttpServer())
      .post('/api/v1/auth/email/change/confirm')
      .send({ token: deliveredToken, newEmail: 'email-delivery-new@example.com' })
      .expect(400);
  });

  it('executes Sprint 2C1 EMAIL enrollment, login, recovery and disable HTTP scenarios', async () => {
    const firstLogin = await verifiedLogin('two-factor-email@example.com');
    const auth = `Bearer ${firstLogin.body.accessToken}`;
    const firstCookies = (firstLogin as request.Response & { deviceCookies: string[] })
      .deviceCookies;
    await request(app.getHttpServer())
      .get('/api/v1/auth/2fa/status')
      .set('Authorization', auth)
      .expect(200)
      .expect((r) => {
        expect(r.body).toEqual({
          enabled: false,
          method: null,
          enabledAt: null,
          recoveryCodesRemaining: 0,
        });
        expect(JSON.stringify(r.body)).not.toMatch(/hash|pepper|token|phone|email/i);
      });
    await request(app.getHttpServer())
      .post('/api/v1/auth/2fa/enroll/request')
      .set('Authorization', auth)
      .send({ method: 'EMAIL', currentPassword: 'wrong password' })
      .expect(401);
    const enrollment = await request(app.getHttpServer())
      .post('/api/v1/auth/2fa/enroll/request')
      .set('Authorization', auth)
      .send({ method: 'EMAIL', currentPassword: base.password })
      .expect(200);
    expect(enrollment.body.challengeId).toEqual(expect.any(String));
    expect(enrollment.body).not.toHaveProperty('code');
    expect(
      prisma.challenges.filter((c) => c.purpose === 'TWO_FACTOR_ENROLLMENT' && !c.consumedAt),
    ).toHaveLength(1);
    const bad = await request(app.getHttpServer())
      .post('/api/v1/auth/2fa/enroll/confirm')
      .set('Authorization', auth)
      .send({ challengeId: enrollment.body.challengeId, code: '000000' })
      .expect(400);
    expect([
      'INVALID_OR_EXPIRED_2FA_CODE',
      'TWO_FACTOR_CHALLENGE_LOCKED',
      'VALIDATION_ERROR',
    ]).toContain(bad.body.code);
    const code = mailer.sent.find((m) => m.purpose === 'TWO_FACTOR_CODE')!.token!;
    const confirmA = request(app.getHttpServer())
      .post('/api/v1/auth/2fa/enroll/confirm')
      .set('Authorization', auth)
      .send({ challengeId: enrollment.body.challengeId, code });
    const confirmB = request(app.getHttpServer())
      .post('/api/v1/auth/2fa/enroll/confirm')
      .set('Authorization', auth)
      .send({ challengeId: enrollment.body.challengeId, code });
    const confirmations = await Promise.all([confirmA, confirmB]);
    expect(confirmations.filter((r) => r.status === 200)).toHaveLength(1);
    expect(confirmations.filter((r) => r.status !== 500)).toHaveLength(2);
    const recoveryCodes = confirmations.find((r) => r.status === 200)!.body
      .recoveryCodes as string[];
    expect(recoveryCodes).toHaveLength(10);
    expect(
      recoveryCodes.every((recoveryCode) =>
        /^[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}$/.test(recoveryCode),
      ),
    ).toBe(true);
    expect(JSON.stringify(prisma.twoFactorRecoveryCodeRows)).not.toContain(recoveryCodes[0]);
    await request(app.getHttpServer())
      .get('/api/v1/auth/2fa/status')
      .set('Authorization', auth)
      .expect(200)
      .expect((r) => {
        expect(r.body.enabled).toBe(true);
        expect(r.body.method).toBe('EMAIL');
        expect(r.body.recoveryCodesRemaining).toBe(10);
      });
    const beforeSessions = prisma.sessions.length;
    const login2fa = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Cookie', firstCookies)
      .send({ email: 'two-factor-email@example.com', password: base.password })
      .expect(202);
    expect(login2fa.body.code).toBe('TWO_FACTOR_REQUIRED');
    expect(prisma.sessions).toHaveLength(beforeSessions);
    const loginCode = mailer.sent.filter((m) => m.purpose === 'TWO_FACTOR_CODE').at(-1)!.token!;
    const verifyA = request(app.getHttpServer())
      .post('/api/v1/auth/2fa/login/verify')
      .set('Cookie', firstCookies)
      .send({ challengeId: login2fa.body.challengeId, code: loginCode });
    const verifyB = request(app.getHttpServer())
      .post('/api/v1/auth/2fa/login/verify')
      .set('Cookie', firstCookies)
      .send({ challengeId: login2fa.body.challengeId, recoveryCode: recoveryCodes[0] });
    const verified = await Promise.all([verifyA, verifyB]);
    expect(verified.every((r) => r.status !== 500)).toBe(true);
    expect(verified.some((r) => r.status === 200 || r.status === 400)).toBe(true);
    const secondLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Cookie', firstCookies)
      .send({ email: 'two-factor-email@example.com', password: base.password })
      .expect(202);
    await request(app.getHttpServer())
      .post('/api/v1/auth/2fa/login/verify')
      .set('Cookie', firstCookies)
      .send({ challengeId: secondLogin.body.challengeId, recoveryCode: recoveryCodes[1] })
      .expect((r) => expect([200, 400]).toContain(r.status));
    await request(app.getHttpServer())
      .post('/api/v1/auth/2fa/login/verify')
      .set('Cookie', firstCookies)
      .send({ challengeId: secondLogin.body.challengeId, recoveryCode: recoveryCodes[1] })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/auth/2fa/disable/request')
      .set('Authorization', auth)
      .send({ currentPassword: base.password })
      .expect((r) => expect([200, 401]).toContain(r.status));
    expect(prisma.events.map((e) => e.eventType)).toEqual(
      expect.arrayContaining([
        'TWO_FACTOR_ENROLLMENT_REQUESTED',
        'TWO_FACTOR_ENABLED',
        'TWO_FACTOR_LOGIN_REQUIRED',
      ]),
    );
  });

  it('executes Sprint 2C1 SMS, delivery failure, resend cooldown and status error scenarios', async () => {
    const login = await verifiedLogin('two-factor-sms@example.com');
    const auth = `Bearer ${login.body.accessToken}`;
    const user = prisma.users.find((u) => u.email === 'two-factor-sms@example.com')!;
    user.phoneE164 = '+5517999991234';
    user.phoneVerifiedAt = new Date();
    await request(app.getHttpServer())
      .post('/api/v1/auth/2fa/enroll/request')
      .set('Authorization', auth)
      .send({ method: 'SMS', currentPassword: base.password })
      .expect(200);
    const smsCode = sms.sent.find((m) => m.purpose === 'TWO_FACTOR_CODE')!.code!;
    const smsChallenge = prisma.challenges.find(
      (c) => c.purpose === 'TWO_FACTOR_ENROLLMENT' && !c.consumedAt,
    )!;
    await request(app.getHttpServer())
      .post('/api/v1/auth/2fa/enroll/confirm')
      .set('Authorization', auth)
      .send({ challengeId: smsChallenge.id, code: smsCode })
      .expect(200);
    const originalSend = (sms as { send?: (...args: unknown[]) => void }).send;
    (sms as { send?: (...args: unknown[]) => void }).send = () => {
      throw new Error('simulated 2fa delivery outage');
    };
    const originalMailerSend = mailer.send.bind(mailer);
    mailer.send = () => {
      throw new Error('simulated 2fa email outage');
    };
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Cookie', (login as request.Response & { deviceCookies: string[] }).deviceCookies)
      .send({ email: 'two-factor-sms@example.com', password: base.password })
      .expect((r) => expect([503, 500]).toContain(r.status));
    expect(
      prisma.challenges.filter((c) => c.purpose === 'TWO_FACTOR_LOGIN' && !c.consumedAt),
    ).toHaveLength(0);
    (sms as { send?: (...args: unknown[]) => void }).send = originalSend;
    mailer.send = originalMailerSend;
    const login2fa = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Cookie', (login as request.Response & { deviceCookies: string[] }).deviceCookies)
      .send({ email: 'two-factor-sms@example.com', password: base.password })
      .expect(202);
    await request(app.getHttpServer())
      .post('/api/v1/auth/2fa/login/resend')
      .set('Cookie', (login as request.Response & { deviceCookies: string[] }).deviceCookies)
      .send({ challengeId: login2fa.body.challengeId })
      .expect((r) => expect([200, 400, 429]).toContain(r.status));
    await request(app.getHttpServer())
      .post('/api/v1/auth/2fa/login/resend')
      .set('Cookie', (login as request.Response & { deviceCookies: string[] }).deviceCookies)
      .send({ challengeId: login2fa.body.challengeId })
      .expect((r) => expect([400, 429]).toContain(r.status));
    await request(app.getHttpServer())
      .post('/api/v1/auth/2fa/login/verify')
      .set('Cookie', (login as request.Response & { deviceCookies: string[] }).deviceCookies)
      .send({ challengeId: login2fa.body.challengeId, recoveryCode: 'bad-format' })
      .expect(400);
  });

  it('executes rate limiting and event assertions through HTTP', async () => {
    for (let i = 0; i < 10; i++)
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ ...base, email: `rl${i}@example.com` });
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ ...base, email: 'limited@example.com' })
      .expect((r) => expect([400, 429]).toContain(r.status));
    expect(
      prisma.events.every(
        (e) =>
          !JSON.stringify(e).match(/valid password|litbuy_device|user@example.com|127\.0\.0\.1/),
      ),
    ).toBe(true);
  });
});
