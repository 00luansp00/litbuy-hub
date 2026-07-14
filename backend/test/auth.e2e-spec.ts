import cookieParser from 'cookie-parser';
import { HttpStatus, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { PrismaService } from '../src/database/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { AuthMailer } from '../src/auth/auth.service';
import { hmacToken, randomToken } from '../src/auth/auth.utils';

type Row = Record<string, unknown>;
const id = () => crypto.randomUUID();
const now = () => new Date();
class Delegate<T extends Row> {
  constructor(private rows: T[]) {}
  async create(args: { data: Row; include?: Row }) {
    await Promise.resolve();
    const row = { id: id(), createdAt: now(), updatedAt: now(), ...args.data } as unknown as T;
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
  async deleteMany() {
    await Promise.resolve();
    const count = this.rows.length;
    this.rows.splice(0);
    return { count };
  }
  all() {
    return this.rows;
  }
  private matches(r: Row, where: Row): boolean {
    return Object.entries(where).every(([k, v]) => {
      if (v && typeof v === 'object' && 'not' in v) return r[k] !== (v as Row).not;
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
  };
  passwordCredential = new Delegate(this.credentials);
  device = new Delegate(this.devices);
  verificationChallenge = new Delegate(this.challenges);
  securityEvent = new Delegate(this.events);
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
  const base = {
    email: 'user@example.com',
    password: 'valid password 123',
    birthDate: '2000-01-01',
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
  });
  afterEach(async () => app.close());
  function register(email = base.email) {
    return request(app.getHttpServer())
      .post('/api/v1/v1/auth/register')
      .send({ ...base, email });
  }
  function verifyLatest() {
    const token = mailer.sent.at(-1)!.token;
    return request(app.getHttpServer()).post('/api/v1/v1/auth/email/verify').send({ token });
  }
  it('executes registration validation scenarios through HTTP', async () => {
    await register()
      .expect(HttpStatus.CREATED)
      .expect((r: request.Response) => {
        expect(r.body).not.toHaveProperty('passwordHash');
        expect(r.headers['set-cookie']).toBeDefined();
      });
    await request(app.getHttpServer())
      .post('/api/v1/v1/auth/register')
      .send({ ...base, email: 'minor@example.com', birthDate: '2010-01-01' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/v1/auth/register')
      .send({ ...base, email: 'exact@example.com', birthDate: '2008-07-14' })
      .expect(HttpStatus.CREATED);
    await request(app.getHttpServer())
      .post('/api/v1/v1/auth/register')
      .send({ ...base, email: 'before@example.com', birthDate: '2008-07-15' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/v1/auth/register')
      .send({ ...base, email: 'future@example.com', birthDate: '2030-01-01' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/v1/auth/register')
      .send({ ...base, email: 'terms@example.com', termsVersion: 'old' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/v1/auth/register')
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
      .post('/api/v1/v1/auth/email/verify')
      .send({ token: `${String(challenge.id)}.${randomToken()}` })
      .expect(400);
    expect(challenge.attempts).toBe(1);
    challenge.attempts = 5;
    await request(app.getHttpServer())
      .post('/api/v1/v1/auth/email/verify')
      .send({ token: `${String(challenge.id)}.${randomToken()}` })
      .expect(400);
    challenge.attempts = 0;
    challenge.expiresAt = new Date(Date.now() - 1000);
    await request(app.getHttpServer())
      .post('/api/v1/v1/auth/email/verify')
      .send({ token: mailer.sent[0].token })
      .expect(400);
    challenge.expiresAt = new Date(Date.now() + 100000);
    await verifyLatest().expect(200);
    await request(app.getHttpServer())
      .post('/api/v1/v1/auth/email/verify')
      .send({ token: mailer.sent[0].token })
      .expect(400);
  });
  it('executes login, device, me, refresh and logout scenarios through HTTP', async () => {
    const reg = await register();
    const deviceCookie = reg.headers['set-cookie'];
    await request(app.getHttpServer())
      .post('/api/v1/v1/auth/login')
      .set('Cookie', deviceCookie)
      .send({ email: base.email, password: base.password })
      .expect(403);
    await verifyLatest();
    await request(app.getHttpServer())
      .post('/api/v1/v1/auth/login')
      .set('Cookie', deviceCookie)
      .send({ email: base.email, password: 'wrong password' })
      .expect(401);
    for (let i = 0; i < 5; i++)
      await request(app.getHttpServer())
        .post('/api/v1/v1/auth/login')
        .set('Cookie', deviceCookie)
        .send({ email: base.email, password: 'wrong password' });
    await request(app.getHttpServer())
      .post('/api/v1/v1/auth/login')
      .set('Cookie', deviceCookie)
      .send({ email: base.email, password: base.password })
      .expect(401);
    prisma.credentials[0].lockedUntil = new Date(Date.now() - 1000);
    const login = await request(app.getHttpServer())
      .post('/api/v1/v1/auth/login')
      .set('Cookie', deviceCookie)
      .send({ email: base.email, password: base.password })
      .expect(200);
    expect(login.body.accessToken).toEqual(expect.any(String));
    await request(app.getHttpServer())
      .get('/api/v1/v1/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(200)
      .expect((r) =>
        expect(JSON.stringify(r.body)).not.toMatch(/passwordHash|tokenHash|csrfTokenHash|pepper/),
      );
    await request(app.getHttpServer())
      .get('/api/v1/v1/auth/me')
      .set('Authorization', 'Bearer invalid')
      .expect(401);
    const authCookies = login.headers['set-cookie'] as unknown as string[];
    await request(app.getHttpServer())
      .post('/api/v1/v1/auth/refresh')
      .set('Cookie', authCookies)
      .expect(401);
    const csrf = String(authCookies.find((c: string) => c.startsWith('litbuy_csrf')))
      .split(';')[0]
      .split('=')[1];
    const refreshed = await request(app.getHttpServer())
      .post('/api/v1/v1/auth/refresh')
      .set('Cookie', authCookies)
      .set('X-CSRF-Token', csrf)
      .expect(200);
    expect(refreshed.body.accessToken).toEqual(expect.any(String));
    await request(app.getHttpServer())
      .post('/api/v1/v1/auth/refresh')
      .set('Cookie', authCookies)
      .set('X-CSRF-Token', csrf)
      .expect(401);
    await request(app.getHttpServer())
      .get('/api/v1/v1/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(401);
  });
  it('executes unknown/shared/pending device and logout csrf scenarios through HTTP', async () => {
    const a = await register('a@example.com');
    await verifyLatest();
    await register('b@example.com');
    await verifyLatest();
    const sharedCookie = a.headers['set-cookie'];
    await request(app.getHttpServer())
      .post('/api/v1/v1/auth/login')
      .set('Cookie', sharedCookie)
      .send({ email: 'b@example.com', password: base.password })
      .expect(202);
    expect(
      prisma.devices.filter(
        (d) =>
          d.userId === prisma.users.find((u) => u.email === 'b@example.com')!.id &&
          d.status === 'PENDING',
      ),
    ).toHaveLength(1);
    await request(app.getHttpServer())
      .post('/api/v1/v1/auth/login')
      .set('Cookie', sharedCookie)
      .send({ email: 'b@example.com', password: base.password })
      .expect(202);
    const approve = mailer.sent.at(-1)!.token;
    await request(app.getHttpServer())
      .post('/api/v1/v1/auth/device/approve')
      .send({ token: approve })
      .expect(200);
    const bCookie = prisma.devices.at(-1)!;
    const raw = randomToken();
    bCookie.tokenHash = hmacToken(raw, process.env.AUTH_DEVICE_TOKEN_PEPPER!);
    const login = await request(app.getHttpServer())
      .post('/api/v1/v1/auth/login')
      .set('Cookie', `litbuy_device=${raw}`)
      .send({ email: 'b@example.com', password: base.password })
      .expect(200);
    const cookies = login.headers['set-cookie'] as unknown as string[];
    await request(app.getHttpServer())
      .post('/api/v1/v1/auth/logout')
      .set('Cookie', cookies)
      .expect(401);
    await request(app.getHttpServer()).post('/api/v1/v1/auth/logout').expect(200);
    const csrf = String(cookies.find((c: string) => c.startsWith('litbuy_csrf')))
      .split(';')[0]
      .split('=')[1];
    await request(app.getHttpServer())
      .post('/api/v1/v1/auth/logout')
      .set('Cookie', cookies)
      .set('X-CSRF-Token', 'bad')
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/v1/auth/logout')
      .set('Cookie', cookies)
      .set('X-CSRF-Token', csrf)
      .expect(200);
    expect(prisma.events.some((e) => e.eventType === 'LOGOUT')).toBe(true);
    expect(prisma.events.some((e) => e.eventType === 'SESSION_REVOKED')).toBe(true);
  });
  it('executes rate limiting and event assertions through HTTP', async () => {
    for (let i = 0; i < 10; i++)
      await request(app.getHttpServer())
        .post('/api/v1/v1/auth/register')
        .send({ ...base, email: `rl${i}@example.com` });
    await request(app.getHttpServer())
      .post('/api/v1/v1/auth/register')
      .send({ ...base, email: 'limited@example.com' })
      .expect(429);
    expect(
      prisma.events.every(
        (e) =>
          !JSON.stringify(e).match(/valid password|litbuy_device|user@example.com|127\.0\.0\.1/),
      ),
    ).toBe(true);
  });
});
