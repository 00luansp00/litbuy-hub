import cookieParser from 'cookie-parser';
import {
  Controller,
  Get,
  HttpStatus,
  Post,
  UseGuards,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { PrismaService } from '../src/database/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthMailer } from '../src/auth/auth.service';
import type { AuthRuntimeConfig } from '../src/auth/auth.types';
import { hashPassword, randomToken } from '../src/auth/auth.utils';
import { AccessTokenGuard } from '../src/auth/access-token.guard';
import { RequireRoles } from '../src/auth/platform-roles';
import { PlatformRolesGuard } from '../src/auth/platform-roles.guard';
import { PlatformRolesService } from '../src/auth/platform-roles.service';
import { PlatformRole } from '@prisma/client';

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

@Controller('test-rbac')
@UseGuards(AccessTokenGuard, PlatformRolesGuard)
class TestRbacController {
  @Get('seller')
  @RequireRoles(PlatformRole.SELLER)
  seller() {
    return { ok: true, area: 'seller' };
  }

  @Post('admin')
  @RequireRoles(PlatformRole.ADMIN)
  admin() {
    return { ok: true, area: 'admin' };
  }
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
  stepUpGrantRows: Row[] = [];
  userRoleAssignments: Row[] = [];
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
      const role = (a.data.roleAssignments as Row | undefined)?.create as Row | undefined;
      if (role) this.userRoleAssignments.push({ userId: u.id, role: role.role, grantedAt: now() });
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
      if (!a.include) return u;
      return {
        ...u,
        passwordCredential: a.include.passwordCredential
          ? (this.credentials.find((c) => c.userId === u.id) ?? null)
          : undefined,
        roleAssignments: a.include.roleAssignments
          ? this.userRoleAssignments.filter((r) => r.userId === u.id).map((r) => ({ role: r.role }))
          : undefined,
      };
    },
    update: async (a: { where: Row; data: Row }) => {
      await Promise.resolve();
      return Object.assign(
        this.users.find((u) => u.id === a.where.id)!,
        a.data,
      );
    },
    findUniqueOrThrow: async (a: { where: Row; include?: Row }) => {
      const user = await this.user.findUnique(a);
      if (!user) throw new Error('not found');
      return user;
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
  private roleDelegate = new Delegate(this.userRoleAssignments);
  userRoleAssignment = {
    findMany: (a: { where?: Row; select?: Row; orderBy?: Row } = {}) =>
      this.roleDelegate.findMany(a),
    count: async (a: { where?: Row } = {}) => {
      await Promise.resolve();
      return this.userRoleAssignments.filter((r) => {
        const where = a.where ?? {};
        if (where.userId && r.userId !== where.userId) return false;
        if (where.role) {
          if (typeof where.role === 'object' && 'in' in where.role) {
            if (!(where.role.in as unknown[]).includes(r.role)) return false;
          } else if (r.role !== where.role) return false;
        }
        if (where.user && typeof where.user === 'object' && 'status' in where.user) {
          const u = this.users.find((user) => user.id === r.userId);
          if (u?.status !== (where.user as Row).status) return false;
        }
        return true;
      }).length;
    },
    findUnique: async (a: { where: Row }) => {
      await Promise.resolve();
      const key = a.where.userId_role as Row | undefined;
      return (
        this.userRoleAssignments.find((r) => r.userId === key?.userId && r.role === key?.role) ??
        null
      );
    },
    createMany: async (a: { data: Row[]; skipDuplicates?: boolean }) => {
      await Promise.resolve();
      let count = 0;
      for (const data of a.data) {
        if (
          this.userRoleAssignments.some((r) => r.userId === data.userId && r.role === data.role)
        ) {
          continue;
        }
        this.userRoleAssignments.push({ ...data, grantedAt: now() });
        count += 1;
      }
      return { count };
    },
    deleteMany: (a: { where?: Row } = {}) => this.roleDelegate.deleteMany(a),
  };
  securityEvent = new Delegate(this.events);
  emailChangeRequest = new Delegate(this.emailChanges);
  twoFactorSettings = new Delegate(this.twoFactorSettingsRows);
  twoFactorRecoveryCode = new Delegate(this.twoFactorRecoveryCodeRows);
  stepUpGrant = new Delegate(this.stepUpGrantRows);
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
      del: async (k: string) => {
        await Promise.resolve();
        return this.counts.delete(k) ? 1 : 0;
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
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule, JwtModule.register({})],
      controllers: [TestRbacController],
      providers: [
        AccessTokenGuard,
        PlatformRolesGuard,
        PlatformRolesService,
        { provide: PrismaService, useValue: prisma },
      ],
    })
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
  afterEach(async () => {
    if (app) await app.close();
  });
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
  async function authenticated(email: string) {
    const reg = await register(email);
    await verifyLatest();
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Cookie', reg.headers['set-cookie'])
      .send({ email, password: base.password })
      .expect(HttpStatus.OK);
    const user = prisma.users.find((u) => u.email === email)!;
    return { user, token: login.body.accessToken as string };
  }

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
  it('enforces test RBAC routes with current database roles', async () => {
    const buyer = await authenticated('buyer@example.com');
    await request(app.getHttpServer())
      .get('/api/v1/test-rbac/seller')
      .expect(HttpStatus.UNAUTHORIZED);
    await request(app.getHttpServer())
      .get('/api/v1/test-rbac/seller')
      .set('Authorization', `Bearer ${buyer.token}`)
      .set('X-Role', 'SELLER')
      .expect(HttpStatus.FORBIDDEN)
      .expect((r) => expect(r.body.code).toBe('INSUFFICIENT_ROLE'));
    await request(app.getHttpServer())
      .post('/api/v1/test-rbac/admin?role=ADMIN')
      .set('Authorization', `Bearer ${buyer.token}`)
      .send({ role: 'ADMIN' })
      .expect(HttpStatus.FORBIDDEN);

    prisma.userRoleAssignments.push({ userId: buyer.user.id, role: PlatformRole.SELLER });
    await request(app.getHttpServer())
      .get('/api/v1/test-rbac/seller')
      .set('Authorization', `Bearer ${buyer.token}`)
      .expect(HttpStatus.OK);
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${buyer.token}`)
      .expect(HttpStatus.OK)
      .expect((r) => expect(r.body.roles).toEqual(['buyer', 'seller']));
    await prisma.userRoleAssignment.deleteMany({
      where: { userId: buyer.user.id as string, role: PlatformRole.SELLER },
    });
    await request(app.getHttpServer())
      .get('/api/v1/test-rbac/seller')
      .set('Authorization', `Bearer ${buyer.token}`)
      .expect(HttpStatus.FORBIDDEN);

    const admin = await authenticated('admin@example.com');
    prisma.userRoleAssignments.push({ userId: admin.user.id, role: PlatformRole.ADMIN });
    await request(app.getHttpServer())
      .post('/api/v1/test-rbac/admin')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(HttpStatus.CREATED);
    admin.user.status = 'SUSPENDED';
    await request(app.getHttpServer())
      .post('/api/v1/test-rbac/admin')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(HttpStatus.UNAUTHORIZED);
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
      .expect(429)
      .expect((r) => expect(r.body.code).toBe('RATE_LIMITED'));

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

  async function verifiedLoginWithUser(email: string) {
    const login = await verifiedLogin(email);
    const user = prisma.users.find((candidate) => candidate.email === email)!;
    return { login, user, auth: `Bearer ${login.body.accessToken as string}` };
  }

  async function enableEmailTwoFactor(auth: string) {
    const enrollment = await request(app.getHttpServer())
      .post('/api/v1/auth/2fa/enroll/request')
      .set('Authorization', auth)
      .send({ method: 'EMAIL', currentPassword: base.password })
      .expect(HttpStatus.OK);
    const code = mailer.sent
      .filter((message) => message.purpose === 'TWO_FACTOR_CODE')
      .at(-1)!.token!;
    const confirmed = await request(app.getHttpServer())
      .post('/api/v1/auth/2fa/enroll/confirm')
      .set('Authorization', auth)
      .send({ challengeId: enrollment.body.challengeId, code })
      .expect(HttpStatus.OK);
    return confirmed.body.recoveryCodes as string[];
  }

  async function requestStepUpChallenge(auth: string, scope = 'TWO_FACTOR_METHOD_CHANGE') {
    return request(app.getHttpServer())
      .post('/api/v1/auth/step-up/request')
      .set('Authorization', auth)
      .send({ scope, currentPassword: base.password })
      .expect(HttpStatus.ACCEPTED);
  }

  async function verifyStepUpChallenge(auth: string, challengeId: string, code?: string) {
    const stepUpCode =
      code ?? mailer.sent.filter((message) => message.purpose === 'TWO_FACTOR_CODE').at(-1)!.token!;
    return request(app.getHttpServer())
      .post('/api/v1/auth/step-up/verify')
      .set('Authorization', auth)
      .send({ challengeId, code: stepUpCode })
      .expect(HttpStatus.OK);
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
      .expect(429)
      .expect((r) => expect(r.body.code).toBe('PHONE_RESEND_COOLDOWN'));
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
    const failingSend: AuthMailer['send'] = async (to, purpose, token) => {
      sends += 1;
      if (purpose === 'EMAIL_CHANGE_CONFIRM_NEW') throw new Error('simulated email outage');
      await originalSend(to, purpose, token);
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

  async function loginOnApprovedSecondDevice(email: string) {
    const pending = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: base.password })
      .expect(202);
    const approval = mailer.sent.at(-1)!.token;
    await request(app.getHttpServer())
      .post('/api/v1/auth/device/approve')
      .send({ token: approval })
      .expect(200);
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Cookie', pending.headers['set-cookie'] as unknown as string[])
      .send({ email, password: base.password })
      .expect(200);
    return {
      auth: `Bearer ${login.body.accessToken}`,
      cookies: pending.headers['set-cookie'] as unknown as string[],
    };
  }

  it('serializes cross-device 2FA enrollment requests through HTTP', async () => {
    const firstLogin = await verifiedLogin('two-factor-cross-device@example.com');
    const authA = `Bearer ${firstLogin.body.accessToken}`;
    const user = prisma.users.find((u) => u.email === 'two-factor-cross-device@example.com')!;
    const deviceA = prisma.devices.find((device) => device.userId === user.id)!;
    const secondDevice = await loginOnApprovedSecondDevice('two-factor-cross-device@example.com');
    const deviceB = prisma.devices.find(
      (device) => device.userId === user.id && device.id !== deviceA.id,
    )!;

    const enrollmentA = await request(app.getHttpServer())
      .post('/api/v1/auth/2fa/enroll/request')
      .set('Authorization', authA)
      .send({ method: 'EMAIL', currentPassword: base.password })
      .expect(200);
    const codeA = mailer.sent.at(-1)!.token!;
    const enrollmentB = await request(app.getHttpServer())
      .post('/api/v1/auth/2fa/enroll/request')
      .set('Authorization', secondDevice.auth)
      .send({ method: 'EMAIL', currentPassword: base.password })
      .expect(200);
    const codeB = mailer.sent.at(-1)!.token!;

    const activeEnrollmentChallenges = prisma.challenges.filter(
      (challenge) => challenge.purpose === 'TWO_FACTOR_ENROLLMENT' && !challenge.consumedAt,
    );
    expect(activeEnrollmentChallenges).toHaveLength(1);
    expect(activeEnrollmentChallenges[0].deviceId).toBe(deviceB.id);
    expect(
      prisma.challenges.find((challenge) => challenge.id === enrollmentA.body.challengeId),
    ).toMatchObject({ consumedAt: expect.any(Date) });
    await request(app.getHttpServer())
      .post('/api/v1/auth/2fa/enroll/confirm')
      .set('Authorization', authA)
      .send({ challengeId: enrollmentA.body.challengeId, code: codeA })
      .expect(400)
      .expect((response) => expect(response.body.code).toBe('INVALID_OR_EXPIRED_2FA_CODE'));
    await request(app.getHttpServer())
      .post('/api/v1/auth/2fa/enroll/confirm')
      .set('Authorization', secondDevice.auth)
      .send({ challengeId: enrollmentB.body.challengeId, code: codeB })
      .expect(200)
      .expect((response) => expect(response.body.recoveryCodes).toHaveLength(10));
    expect(prisma.events.filter((event) => event.eventType === 'TWO_FACTOR_ENABLED')).toHaveLength(
      1,
    );

    const concurrentLogin = await verifiedLogin('two-factor-cross-device-concurrent@example.com');
    const concurrentAuthA = `Bearer ${concurrentLogin.body.accessToken}`;
    const concurrentSecondDevice = await loginOnApprovedSecondDevice(
      'two-factor-cross-device-concurrent@example.com',
    );
    const concurrentResponses = await Promise.all([
      request(app.getHttpServer())
        .post('/api/v1/auth/2fa/enroll/request')
        .set('Authorization', concurrentAuthA)
        .send({ method: 'EMAIL', currentPassword: base.password }),
      request(app.getHttpServer())
        .post('/api/v1/auth/2fa/enroll/request')
        .set('Authorization', concurrentSecondDevice.auth)
        .send({ method: 'EMAIL', currentPassword: base.password }),
    ]);
    expect(concurrentResponses.map((response) => response.status)).not.toContain(500);
    expect(
      concurrentResponses.every((response) =>
        [HttpStatus.OK, HttpStatus.CONFLICT].includes(response.status),
      ),
    ).toBe(true);
    expect(
      JSON.stringify(concurrentResponses.map((response) => response.body as unknown)),
    ).not.toMatch(/P2002|constraint|SQL/i);
    expect(
      prisma.challenges.filter(
        (challenge) =>
          challenge.purpose === 'TWO_FACTOR_ENROLLMENT' &&
          challenge.userId ===
            prisma.users.find(
              (candidate) => candidate.email === 'two-factor-cross-device-concurrent@example.com',
            )!.id &&
          !challenge.consumedAt,
      ),
    ).toHaveLength(1);
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
        expect(Object.keys(r.body).sort()).toEqual(
          ['enabled', 'enabledAt', 'method', 'recoveryCodesRemaining'].sort(),
        );
        expect(r.body).toEqual({
          enabled: false,
          method: null,
          enabledAt: null,
          recoveryCodesRemaining: 0,
        });
        expect(sensitiveResponsePropertyPaths(r.body)).toEqual([]);
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
    expect(bad.body.code).toBe('INVALID_OR_EXPIRED_2FA_CODE');
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
    expect(confirmations.filter((r) => r.status >= 400 && r.status < 500)).toHaveLength(1);
    expect(confirmations.map((r) => r.status)).not.toContain(500);
    expect(prisma.events.filter((e) => e.eventType === 'TWO_FACTOR_ENABLED')).toHaveLength(1);
    expect(prisma.twoFactorSettingsRows.filter((row) => !row.disabledAt)).toHaveLength(1);
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
        expect(Object.keys(r.body).sort()).toEqual(
          ['enabled', 'enabledAt', 'method', 'recoveryCodesRemaining'].sort(),
        );
        expect(r.body.enabled).toBe(true);
        expect(r.body.method).toBe('EMAIL');
        expect(new Date(r.body.enabledAt).toString()).not.toBe('Invalid Date');
        expect(r.body.recoveryCodesRemaining).toBe(10);
        expect(sensitiveResponsePropertyPaths(r.body)).toEqual([]);
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
    const beforeRefreshTokens = prisma.refreshTokens.length;
    const verified = await Promise.all([verifyA, verifyB]);
    expect(verified.filter((r) => r.status === 200)).toHaveLength(1);
    expect(verified.filter((r) => r.status >= 400 && r.status < 500)).toHaveLength(1);
    expect(verified.map((r) => r.status)).not.toContain(500);
    expect(prisma.sessions).toHaveLength(beforeSessions + 1);
    expect(prisma.refreshTokens).toHaveLength(beforeRefreshTokens + 1);
    const secondLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Cookie', firstCookies)
      .send({ email: 'two-factor-email@example.com', password: base.password })
      .expect(202);
    const recoveryLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/2fa/login/verify')
      .set('Cookie', firstCookies)
      .send({
        challengeId: secondLogin.body.challengeId,
        recoveryCode: ` ${recoveryCodes[1].toLowerCase()} `,
      })
      .expect(200);
    await request(app.getHttpServer())
      .post('/api/v1/auth/2fa/login/verify')
      .set('Cookie', firstCookies)
      .send({ challengeId: secondLogin.body.challengeId, recoveryCode: recoveryCodes[1] })
      .expect(400);
    expect(recoveryLogin.body.accessToken).toEqual(expect.any(String));
    const activeSession = prisma.sessions
      .filter((session) => session.userId === prisma.users[0].id && !session.revokedAt)
      .at(-1)!;
    const disableAccessToken = await jwt.signAsync(
      { sub: activeSession.userId, sid: activeSession.id, type: 'access' },
      { secret: authSecret, expiresIn: '15m' },
    );
    prisma.credentials.find(
      (credential) => credential.userId === activeSession.userId,
    )!.passwordHash = await hashPassword(base.password);
    await request(app.getHttpServer())
      .post('/api/v1/auth/2fa/disable/request')
      .set('Authorization', `Bearer ${disableAccessToken}`)
      .send({ currentPassword: base.password })
      .expect(200);
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
      .expect(503)
      .expect((r) => expect(r.body.code).toBe('TWO_FACTOR_DELIVERY_UNAVAILABLE'));
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
    const resent = await request(app.getHttpServer())
      .post('/api/v1/auth/2fa/login/resend')
      .set('Cookie', (login as request.Response & { deviceCookies: string[] }).deviceCookies)
      .send({ challengeId: login2fa.body.challengeId })
      .expect(200);
    await request(app.getHttpServer())
      .post('/api/v1/auth/2fa/login/resend')
      .set('Cookie', (login as request.Response & { deviceCookies: string[] }).deviceCookies)
      .send({ challengeId: resent.body.challengeId })
      .expect(429)
      .expect((r) => expect(r.body.code).toBe('RATE_LIMITED'));
    await request(app.getHttpServer())
      .post('/api/v1/auth/2fa/login/verify')
      .set('Cookie', (login as request.Response & { deviceCookies: string[] }).deviceCookies)
      .send({ challengeId: login2fa.body.challengeId, recoveryCode: 'bad-format' })
      .expect(400);
  });

  it('executes Sprint 2C2A step-up, method change and recovery regeneration HTTP scenarios', async () => {
    const login = await verifiedLogin('step-up-2c2a@example.com');
    const auth = `Bearer ${login.body.accessToken}`;
    const user = prisma.users.find((candidate) => candidate.email === 'step-up-2c2a@example.com')!;
    user.phoneE164 = '+5517999991234';
    user.phoneVerifiedAt = new Date();

    await request(app.getHttpServer())
      .post('/api/v1/auth/step-up/request')
      .set('Authorization', auth)
      .send({ scope: 'TWO_FACTOR_METHOD_CHANGE', currentPassword: base.password })
      .expect(HttpStatus.BAD_REQUEST)
      .expect((response) => expect(response.body.code).toBe('STEP_UP_NOT_AVAILABLE'));

    const enrollment = await request(app.getHttpServer())
      .post('/api/v1/auth/2fa/enroll/request')
      .set('Authorization', auth)
      .send({ method: 'EMAIL', currentPassword: base.password })
      .expect(HttpStatus.OK);
    const enrollmentCode = mailer.sent.at(-1)!.token!;
    const enrollmentConfirm = await request(app.getHttpServer())
      .post('/api/v1/auth/2fa/enroll/confirm')
      .set('Authorization', auth)
      .send({ challengeId: enrollment.body.challengeId, code: enrollmentCode })
      .expect(HttpStatus.OK);
    const oldRecoveryCode = enrollmentConfirm.body.recoveryCodes[0] as string;

    await request(app.getHttpServer())
      .post('/api/v1/auth/step-up/request')
      .set('Authorization', auth)
      .send({ scope: 'TWO_FACTOR_METHOD_CHANGE', currentPassword: 'wrong password' })
      .expect(HttpStatus.UNAUTHORIZED);

    const methodStepUp = await request(app.getHttpServer())
      .post('/api/v1/auth/step-up/request')
      .set('Authorization', auth)
      .send({ scope: 'TWO_FACTOR_METHOD_CHANGE', currentPassword: base.password })
      .expect(HttpStatus.ACCEPTED)
      .expect((response) => {
        expect(response.body).toMatchObject({
          challengeId: expect.any(String),
          scope: 'TWO_FACTOR_METHOD_CHANGE',
          method: 'EMAIL',
        });
        expect(JSON.stringify(response.body)).not.toMatch(
          /stepUpToken|tokenHash|123456|@example|99999/,
        );
      });
    const recoveryStepUp = await request(app.getHttpServer())
      .post('/api/v1/auth/step-up/request')
      .set('Authorization', auth)
      .send({ scope: 'TWO_FACTOR_RECOVERY_REGENERATE', currentPassword: base.password })
      .expect(HttpStatus.ACCEPTED);
    expect(recoveryStepUp.body).toMatchObject({ scope: 'TWO_FACTOR_RECOVERY_REGENERATE' });
    expect(
      prisma.challenges.filter(
        (challenge) => challenge.purpose === 'TWO_FACTOR_STEP_UP' && !challenge.consumedAt,
      ),
    ).toHaveLength(2);
    const methodStepUpReplacement = await request(app.getHttpServer())
      .post('/api/v1/auth/step-up/request')
      .set('Authorization', auth)
      .send({ scope: 'TWO_FACTOR_METHOD_CHANGE', currentPassword: base.password })
      .expect(HttpStatus.ACCEPTED);
    expect(
      prisma.challenges.find((challenge) => challenge.id === methodStepUp.body.challengeId),
    ).toMatchObject({ consumedAt: expect.any(Date) });
    expect(
      prisma.challenges.filter(
        (challenge) => challenge.purpose === 'TWO_FACTOR_STEP_UP' && !challenge.consumedAt,
      ),
    ).toHaveLength(2);

    const invalidVerifyChallenge = methodStepUpReplacement.body.challengeId as string;
    let locked = false;
    for (let index = 0; index < 5; index += 1) {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/step-up/verify')
        .set('Authorization', auth)
        .send({ challengeId: invalidVerifyChallenge, code: '000000' })
        .expect(HttpStatus.BAD_REQUEST);
      expect(['INVALID_OR_EXPIRED_STEP_UP_CODE', 'STEP_UP_CHALLENGE_LOCKED']).toContain(
        response.body.code,
      );
      locked ||= response.body.code === 'STEP_UP_CHALLENGE_LOCKED';
      if (locked) break;
    }
    expect(locked).toBe(true);
    expect(
      Number(
        prisma.challenges.find((challenge) => challenge.id === invalidVerifyChallenge)?.attempts,
      ),
    ).toBeGreaterThanOrEqual(1);
    expect(prisma.stepUpGrantRows).toHaveLength(0);
    expect(
      prisma.events.filter((event) => event.eventType === 'STEP_UP_FAILED').length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      JSON.stringify(prisma.events.filter((event) => event.eventType === 'STEP_UP_FAILED')),
    ).not.toMatch(/000000|tokenHash|stepUpToken|pepper|@example|SQL|constraint/);

    const usableMethodStepUp = await request(app.getHttpServer())
      .post('/api/v1/auth/step-up/request')
      .set('Authorization', auth)
      .send({ scope: 'TWO_FACTOR_METHOD_CHANGE', currentPassword: base.password })
      .expect(HttpStatus.ACCEPTED);
    const resend = await request(app.getHttpServer())
      .post('/api/v1/auth/step-up/resend')
      .set('Authorization', auth)
      .send({ challengeId: usableMethodStepUp.body.challengeId })
      .expect(HttpStatus.OK);
    await request(app.getHttpServer())
      .post('/api/v1/auth/step-up/resend')
      .set('Authorization', auth)
      .send({ challengeId: usableMethodStepUp.body.challengeId })
      .expect(HttpStatus.BAD_REQUEST)
      .expect((response) => expect(response.body.code).toBe('INVALID_OR_EXPIRED_STEP_UP_CODE'));
    const methodCode = mailer.sent
      .filter((message) => message.purpose === 'TWO_FACTOR_CODE')
      .at(-1)!.token!;
    const methodGrant = await request(app.getHttpServer())
      .post('/api/v1/auth/step-up/verify')
      .set('Authorization', auth)
      .send({ challengeId: resend.body.challengeId, code: methodCode })
      .expect(HttpStatus.OK);
    expect(methodGrant.body.stepUpToken).toEqual(expect.any(String));
    expect(JSON.stringify(prisma.stepUpGrantRows)).not.toContain(methodGrant.body.stepUpToken);
    await request(app.getHttpServer())
      .post('/api/v1/auth/2fa/recovery/regenerate')
      .set('Authorization', auth)
      .set('X-Step-Up-Token', methodGrant.body.stepUpToken)
      .expect(HttpStatus.BAD_REQUEST)
      .expect((response) => expect(response.body.code).toBe('STEP_UP_SCOPE_MISMATCH'));

    const methodChange = await request(app.getHttpServer())
      .post('/api/v1/auth/2fa/method/change/request')
      .set('Authorization', auth)
      .set('X-Step-Up-Token', methodGrant.body.stepUpToken)
      .send({ newMethod: 'SMS' })
      .expect(HttpStatus.OK);
    expect(sms.sent.at(-1)?.purpose).toBe('TWO_FACTOR_CODE');
    const methodChangeCode = sms.sent.at(-1)!.code!;
    await request(app.getHttpServer())
      .post('/api/v1/auth/2fa/method/change/confirm')
      .set('Authorization', auth)
      .set('X-Step-Up-Token', methodGrant.body.stepUpToken)
      .send({ challengeId: methodChange.body.challengeId, code: '000000' })
      .expect(HttpStatus.BAD_REQUEST)
      .expect((response) => expect(response.body.code).toBe('INVALID_OR_EXPIRED_STEP_UP_CODE'));
    expect(prisma.stepUpGrantRows.find((grant) => grant.tokenHash)?.consumedAt).toBeNull();
    await request(app.getHttpServer())
      .post('/api/v1/auth/2fa/method/change/confirm')
      .set('Authorization', auth)
      .set('X-Step-Up-Token', methodGrant.body.stepUpToken)
      .send({ challengeId: methodChange.body.challengeId, code: methodChangeCode })
      .expect(HttpStatus.OK);
    expect(
      prisma.twoFactorSettingsRows.find((settings) => settings.userId === user.id)?.method,
    ).toBe('SMS');
    expect(
      mailer.sent.some((message) => message.purpose === 'TWO_FACTOR_METHOD_CHANGED_NOTICE'),
    ).toBe(true);

    const freshRecoveryStepUp = await request(app.getHttpServer())
      .post('/api/v1/auth/step-up/request')
      .set('Authorization', auth)
      .send({ scope: 'TWO_FACTOR_RECOVERY_REGENERATE', currentPassword: base.password })
      .expect(HttpStatus.ACCEPTED);
    const recoveryCode = sms.sent
      .filter((message) => message.purpose === 'TWO_FACTOR_CODE')
      .at(-1)!.code!;
    const recoveryGrant = await request(app.getHttpServer())
      .post('/api/v1/auth/step-up/verify')
      .set('Authorization', auth)
      .send({ challengeId: freshRecoveryStepUp.body.challengeId, code: recoveryCode })
      .expect(HttpStatus.OK);
    const regenerated = await request(app.getHttpServer())
      .post('/api/v1/auth/2fa/recovery/regenerate')
      .set('Authorization', auth)
      .set('X-Step-Up-Token', recoveryGrant.body.stepUpToken)
      .expect(HttpStatus.OK);
    expect(regenerated.body.recoveryCodes).toHaveLength(10);
    expect(JSON.stringify(prisma.twoFactorRecoveryCodeRows)).not.toContain(
      regenerated.body.recoveryCodes[0],
    );
    expect(
      mailer.sent.some(
        (message) => message.purpose === 'TWO_FACTOR_RECOVERY_CODES_REGENERATED_NOTICE',
      ),
    ).toBe(true);
    await request(app.getHttpServer())
      .post('/api/v1/auth/2fa/recovery/regenerate')
      .set('Authorization', auth)
      .set('X-Step-Up-Token', recoveryGrant.body.stepUpToken)
      .expect(HttpStatus.BAD_REQUEST)
      .expect((response) => expect(response.body.code).toBe('INVALID_OR_EXPIRED_STEP_UP_GRANT'));
    await request(app.getHttpServer())
      .post('/api/v1/auth/step-up/verify')
      .set('Authorization', auth)
      .send({ challengeId: freshRecoveryStepUp.body.challengeId, recoveryCode: oldRecoveryCode })
      .expect(HttpStatus.BAD_REQUEST);
  });

  describe('Sprint 2C2A split step-up coverage', () => {
    it('step-up request keeps two scopes active and replaces only the same scope', async () => {
      const { auth } = await verifiedLoginWithUser('step-up-request-split@example.com');
      await enableEmailTwoFactor(auth);
      const method = await requestStepUpChallenge(auth, 'TWO_FACTOR_METHOD_CHANGE');
      const recovery = await requestStepUpChallenge(auth, 'TWO_FACTOR_RECOVERY_REGENERATE');
      expect(method.body.challengeId).not.toBe(recovery.body.challengeId);
      const active = prisma.challenges.filter(
        (challenge) => challenge.purpose === 'TWO_FACTOR_STEP_UP' && !challenge.consumedAt,
      );
      expect(active).toHaveLength(2);
      expect(new Set(active.map((challenge) => challenge.targetHash))).toHaveProperty('size', 2);
      const replacement = await requestStepUpChallenge(auth, 'TWO_FACTOR_METHOD_CHANGE');
      expect(replacement.body.challengeId).not.toBe(method.body.challengeId);
      expect(
        prisma.challenges.find((challenge) => challenge.id === method.body.challengeId),
      ).toMatchObject({
        consumedAt: expect.any(Date),
      });
      expect(
        prisma.challenges.filter(
          (challenge) => challenge.purpose === 'TWO_FACTOR_STEP_UP' && !challenge.consumedAt,
        ),
      ).toHaveLength(2);
    });

    it('step-up verify persists exact attempts and locks on the fifth failure', async () => {
      const { auth } = await verifiedLoginWithUser('step-up-attempts-split@example.com');
      const recoveryCodes = await enableEmailTwoFactor(auth);
      const challenge = await requestStepUpChallenge(auth, 'TWO_FACTOR_METHOD_CHANGE');
      const failedBefore = prisma.events.filter(
        (event) => event.eventType === 'STEP_UP_FAILED',
      ).length;
      prisma.challenges.find((row) => row.id === challenge.body.challengeId)!.maxAttempts = 5;
      for (let attempt = 1; attempt <= 5; attempt += 1) {
        const response = await request(app.getHttpServer())
          .post('/api/v1/auth/step-up/verify')
          .set('Authorization', auth)
          .send({ challengeId: challenge.body.challengeId, code: '000000' })
          .expect(HttpStatus.BAD_REQUEST);
        const persistedAttempts = Number(
          prisma.challenges.find((row) => row.id === challenge.body.challengeId)?.attempts,
        );
        expect(persistedAttempts).toBe(attempt);
        expect(response.body.code).toBe(
          persistedAttempts === 5 ? 'STEP_UP_CHALLENGE_LOCKED' : 'INVALID_OR_EXPIRED_STEP_UP_CODE',
        );
      }
      const correct = mailer.sent
        .filter((message) => message.purpose === 'TWO_FACTOR_CODE')
        .at(-1)!.token!;
      await request(app.getHttpServer())
        .post('/api/v1/auth/step-up/verify')
        .set('Authorization', auth)
        .send({ challengeId: challenge.body.challengeId, code: correct })
        .expect(HttpStatus.BAD_REQUEST)
        .expect((response) => expect(response.body.code).toBe('STEP_UP_CHALLENGE_LOCKED'));
      expect(prisma.stepUpGrantRows).toHaveLength(0);
      expect(prisma.twoFactorRecoveryCodeRows.some((row) => row.usedAt)).toBe(false);
      const failures = prisma.events
        .filter((event) => event.eventType === 'STEP_UP_FAILED')
        .slice(failedBefore);
      expect(failures).toHaveLength(6);
      expect(
        failures.slice(0, 5).map((event) => (event.metadata as { reason: string }).reason),
      ).toEqual(['INVALID_CODE', 'INVALID_CODE', 'INVALID_CODE', 'INVALID_CODE', 'LOCKED']);
      expect(Object.keys(failures[0].metadata as Record<string, unknown>).sort()).toEqual([
        'outcome',
        'reason',
        'scope',
      ]);
      expect(JSON.stringify(failures)).not.toMatch(
        /000000|"code"|recoveryCode|stepUpToken|tokenHash|email|phone|pepper|cookie|SQL|constraint|Prisma/i,
      );
      expect(recoveryCodes).toHaveLength(10);
    });

    it('step-up resend is deterministic for replaced, rate-limited, expired, locked and delivery-failure challenges', async () => {
      const { auth } = await verifiedLoginWithUser('step-up-resend-split@example.com');
      await enableEmailTwoFactor(auth);
      const original = await requestStepUpChallenge(auth);
      const activeBefore = prisma.challenges.filter(
        (challenge) => challenge.purpose === 'TWO_FACTOR_STEP_UP' && !challenge.consumedAt,
      ).length;
      const resent = await request(app.getHttpServer())
        .post('/api/v1/auth/step-up/resend')
        .set('Authorization', auth)
        .send({ challengeId: original.body.challengeId })
        .expect(HttpStatus.OK);
      expect(
        prisma.challenges.find((challenge) => challenge.id === original.body.challengeId),
      ).toMatchObject({
        consumedAt: expect.any(Date),
      });
      expect(
        prisma.challenges.find((challenge) => challenge.id === resent.body.challengeId),
      ).toMatchObject({
        consumedAt: null,
        targetHash: prisma.challenges.find(
          (challenge) => challenge.id === original.body.challengeId,
        )?.targetHash,
      });
      await request(app.getHttpServer())
        .post('/api/v1/auth/step-up/resend')
        .set('Authorization', auth)
        .send({ challengeId: original.body.challengeId })
        .expect(HttpStatus.BAD_REQUEST)
        .expect((response) => expect(response.body.code).toBe('INVALID_OR_EXPIRED_STEP_UP_CODE'));
      expect(
        prisma.challenges.filter(
          (challenge) => challenge.purpose === 'TWO_FACTOR_STEP_UP' && !challenge.consumedAt,
        ),
      ).toHaveLength(activeBefore);
      await request(app.getHttpServer())
        .post('/api/v1/auth/step-up/resend')
        .set('Authorization', auth)
        .send({ challengeId: resent.body.challengeId })
        .expect(HttpStatus.TOO_MANY_REQUESTS)
        .expect((response) => expect(response.body.code).toBe('RATE_LIMITED'));

      const expired = await requestStepUpChallenge(auth, 'TWO_FACTOR_RECOVERY_REGENERATE');
      Object.assign(
        prisma.challenges.find((challenge) => challenge.id === expired.body.challengeId)!,
        {
          expiresAt: new Date(Date.now() - 1_000),
        },
      );
      await request(app.getHttpServer())
        .post('/api/v1/auth/step-up/resend')
        .set('Authorization', auth)
        .send({ challengeId: expired.body.challengeId })
        .expect(HttpStatus.BAD_REQUEST)
        .expect((response) => expect(response.body.code).toBe('INVALID_OR_EXPIRED_STEP_UP_CODE'));

      const locked = await requestStepUpChallenge(auth, 'TWO_FACTOR_RECOVERY_REGENERATE');
      Object.assign(
        prisma.challenges.find((challenge) => challenge.id === locked.body.challengeId)!,
        {
          attempts: 5,
        },
      );
      await request(app.getHttpServer())
        .post('/api/v1/auth/step-up/resend')
        .set('Authorization', auth)
        .send({ challengeId: locked.body.challengeId })
        .expect(HttpStatus.BAD_REQUEST)
        .expect((response) => expect(response.body.code).toBe('INVALID_OR_EXPIRED_STEP_UP_CODE'));

      const deliver = await requestStepUpChallenge(auth, 'TWO_FACTOR_RECOVERY_REGENERATE');
      const originalSend = mailer.send.bind(mailer);
      mailer.send = () => {
        throw new Error('simulated step-up resend delivery failure');
      };
      await request(app.getHttpServer())
        .post('/api/v1/auth/step-up/resend')
        .set('Authorization', auth)
        .send({ challengeId: deliver.body.challengeId })
        .expect(HttpStatus.SERVICE_UNAVAILABLE)
        .expect((response) => expect(response.body.code).toBe('STEP_UP_DELIVERY_UNAVAILABLE'));
      mailer.send = originalSend;
      expect(
        prisma.challenges.find((challenge) => challenge.id === deliver.body.challengeId)
          ?.consumedAt,
      ).toEqual(expect.any(Date));
      expect(prisma.stepUpGrantRows).toHaveLength(0);
    });

    it('method change validates grant/challenge binding and exact attempts before success', async () => {
      const { auth, user } = await verifiedLoginWithUser('method-change-binding-split@example.com');
      user.phoneE164 = '+5517999991234';
      user.phoneVerifiedAt = new Date();
      await enableEmailTwoFactor(auth);
      const grantAChallenge = await requestStepUpChallenge(auth);
      const grantA = await verifyStepUpChallenge(auth, grantAChallenge.body.challengeId);
      const grantBChallenge = await requestStepUpChallenge(auth, 'TWO_FACTOR_RECOVERY_REGENERATE');
      const grantB = await verifyStepUpChallenge(auth, grantBChallenge.body.challengeId);
      const methodChange = await request(app.getHttpServer())
        .post('/api/v1/auth/2fa/method/change/request')
        .set('Authorization', auth)
        .set('X-Step-Up-Token', grantA.body.stepUpToken)
        .send({ newMethod: 'SMS' })
        .expect(HttpStatus.OK);
      const beforeEvents = prisma.events.filter(
        (event) => event.eventType === 'TWO_FACTOR_METHOD_CHANGED',
      ).length;
      const holdBeforeBindingFailure = prisma.users.find(
        (candidate) => candidate.id === user.id,
      )?.sensitiveActionHoldUntil;
      await request(app.getHttpServer())
        .post('/api/v1/auth/2fa/method/change/confirm')
        .set('Authorization', auth)
        .set('X-Step-Up-Token', grantB.body.stepUpToken)
        .send({ challengeId: methodChange.body.challengeId, code: sms.sent.at(-1)!.code })
        .expect(HttpStatus.BAD_REQUEST)
        .expect((response) => expect(response.body.code).toBe('TWO_FACTOR_METHOD_CHANGE_CONFLICT'));
      expect(prisma.stepUpGrantRows.every((grant) => !grant.consumedAt)).toBe(true);
      expect(
        prisma.challenges.find((challenge) => challenge.id === methodChange.body.challengeId)
          ?.consumedAt,
      ).toBeNull();
      expect(
        prisma.twoFactorSettingsRows.find((settings) => settings.userId === user.id)?.method,
      ).toBe('EMAIL');
      expect(
        prisma.users.find((candidate) => candidate.id === user.id)?.sensitiveActionHoldUntil,
      ).toBe(holdBeforeBindingFailure);
      expect(
        prisma.events.filter((event) => event.eventType === 'TWO_FACTOR_METHOD_CHANGED'),
      ).toHaveLength(beforeEvents);
      prisma.challenges.find(
        (challenge) => challenge.id === methodChange.body.challengeId,
      )!.maxAttempts = 5;
      for (let attempt = 1; attempt <= 5; attempt += 1) {
        await request(app.getHttpServer())
          .post('/api/v1/auth/2fa/method/change/confirm')
          .set('Authorization', auth)
          .set('X-Step-Up-Token', grantA.body.stepUpToken)
          .send({ challengeId: methodChange.body.challengeId, code: '000000' })
          .expect(HttpStatus.BAD_REQUEST);
        expect(
          prisma.challenges.find((challenge) => challenge.id === methodChange.body.challengeId)
            ?.attempts,
        ).toBe(attempt);
      }
      await request(app.getHttpServer())
        .post('/api/v1/auth/2fa/method/change/confirm')
        .set('Authorization', auth)
        .set('X-Step-Up-Token', grantA.body.stepUpToken)
        .send({ challengeId: methodChange.body.challengeId, code: sms.sent.at(-1)!.code })
        .expect(HttpStatus.BAD_REQUEST)
        .expect((response) => expect(response.body.code).toBe('STEP_UP_CHALLENGE_LOCKED'));
      expect(prisma.stepUpGrantRows.every((grant) => !grant.consumedAt)).toBe(true);
      expect(
        prisma.twoFactorSettingsRows.find((settings) => settings.userId === user.id)?.method,
      ).toBe('EMAIL');
    });

    it('delivery and notification failures stay controlled and post-commit best-effort', async () => {
      const { auth, user } = await verifiedLoginWithUser('delivery-notification-split@example.com');
      user.phoneE164 = '+5517999991234';
      user.phoneVerifiedAt = new Date();
      await enableEmailTwoFactor(auth);
      const holdAfterEnrollment = prisma.users.find(
        (candidate) => candidate.id === user.id,
      )?.sensitiveActionHoldUntil;
      const originalMailSend = mailer.send.bind(mailer);
      mailer.send = () => {
        throw new Error('simulated step-up email failure');
      };
      await request(app.getHttpServer())
        .post('/api/v1/auth/step-up/request')
        .set('Authorization', auth)
        .send({ scope: 'TWO_FACTOR_METHOD_CHANGE', currentPassword: base.password })
        .expect(HttpStatus.SERVICE_UNAVAILABLE)
        .expect((response) => expect(response.body.code).toBe('STEP_UP_DELIVERY_UNAVAILABLE'));
      expect(prisma.stepUpGrantRows).toHaveLength(0);
      mailer.send = originalMailSend;

      const grantChallenge = await requestStepUpChallenge(auth);
      const grant = await verifyStepUpChallenge(auth, grantChallenge.body.challengeId);
      const smsPort = sms as typeof sms & { send: (...args: unknown[]) => void };
      const originalSmsSend = smsPort.send.bind(smsPort);
      smsPort.send = () => {
        throw new Error('simulated method change sms failure');
      };
      await request(app.getHttpServer())
        .post('/api/v1/auth/2fa/method/change/request')
        .set('Authorization', auth)
        .set('X-Step-Up-Token', grant.body.stepUpToken)
        .send({ newMethod: 'SMS' })
        .expect(HttpStatus.SERVICE_UNAVAILABLE)
        .expect((response) => expect(response.body.code).toBe('STEP_UP_DELIVERY_UNAVAILABLE'));
      smsPort.send = originalSmsSend;
      expect(
        prisma.twoFactorSettingsRows.find((settings) => settings.userId === user.id)?.method,
      ).toBe('EMAIL');
      expect(
        prisma.users.find((candidate) => candidate.id === user.id)?.sensitiveActionHoldUntil,
      ).toBe(holdAfterEnrollment);

      const notificationGrantChallenge = await requestStepUpChallenge(auth);
      const notificationGrant = await verifyStepUpChallenge(
        auth,
        notificationGrantChallenge.body.challengeId,
      );
      const methodChange = await request(app.getHttpServer())
        .post('/api/v1/auth/2fa/method/change/request')
        .set('Authorization', auth)
        .set('X-Step-Up-Token', notificationGrant.body.stepUpToken)
        .send({ newMethod: 'SMS' })
        .expect(HttpStatus.OK);
      mailer.send = async (_to, purpose) => {
        if (purpose === 'TWO_FACTOR_METHOD_CHANGED_NOTICE')
          throw new Error('simulated notice failure');
        await originalMailSend(_to, purpose);
      };
      await request(app.getHttpServer())
        .post('/api/v1/auth/2fa/method/change/confirm')
        .set('Authorization', auth)
        .set('X-Step-Up-Token', notificationGrant.body.stepUpToken)
        .send({ challengeId: methodChange.body.challengeId, code: sms.sent.at(-1)!.code })
        .expect(HttpStatus.OK);
      mailer.send = originalMailSend;
      expect(
        prisma.twoFactorSettingsRows.find((settings) => settings.userId === user.id)?.method,
      ).toBe('SMS');
    });
  });

  it('executes rate limiting and event assertions through HTTP', async () => {
    for (let i = 0; i < 10; i++)
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ ...base, email: `rl${i}@example.com` });
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ ...base, email: 'limited@example.com' })
      .expect(429)
      .expect((r) => expect(r.body.code).toBe('RATE_LIMITED'));
    expect(
      prisma.events.every(
        (e) =>
          !JSON.stringify(e).match(/valid password|litbuy_device|user@example.com|127\.0\.0\.1/),
      ),
    ).toBe(true);
  });
});
