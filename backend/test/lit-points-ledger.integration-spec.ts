import cookieParser from 'cookie-parser';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AuthMailer } from '../src/auth/auth.service';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import type { AppConfig } from '../src/config/app.config';
import { PrismaService } from '../src/database/prisma.service';
import { LitPointsLedgerService } from '../src/lit-points/lit-points-ledger.service';
import { RedisService } from '../src/redis/redis.service';

const password = 'lit points integration password 123';
type Actor = { userId: string; authorization: string };

describe('LIT Points ledger with real auth and PostgreSQL', () => {
  jest.setTimeout(120_000);
  let app: INestApplication;
  let prisma: PrismaService;
  let ledger: LitPointsLedgerService;
  let mailer: AuthMailer;
  let redis: RedisService;

  beforeAll(async () => {
    const ref = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = ref.createNestApplication();
    const config = app.get(ConfigService).getOrThrow<AppConfig>('app');
    app.setGlobalPrefix(config.apiPrefix);
    app.enableVersioning({ type: VersioningType.URI });
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }),
    );
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);
    ledger = app.get(LitPointsLedgerService);
    mailer = app.get(AuthMailer);
    redis = app.get(RedisService);
  });

  beforeEach(async () => {
    await (await redis.getClient()).flushdb();
    mailer.sent.splice(0);
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "User" CASCADE');
  });
  afterAll(() => app?.close());

  async function actor(): Promise<Actor> {
    const email = `points-${crypto.randomUUID()}@example.test`;
    const registration = await request(app.getHttpServer()).post('/api/v1/auth/register').send({
      email,
      password,
      birthDate: '2000-01-01',
      termsAccepted: true,
      privacyAccepted: true,
      termsVersion: process.env.CURRENT_TERMS_VERSION,
      privacyVersion: process.env.CURRENT_PRIVACY_VERSION,
    });
    const token = mailer.sent.find(
      (item) => item.to === email && item.purpose === 'EMAIL_VERIFICATION',
    )?.token;
    await request(app.getHttpServer())
      .post('/api/v1/auth/email/verify')
      .send({ token })
      .expect(200);
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Cookie', registration.headers['set-cookie'] as unknown as string[])
      .send({ email, password })
      .expect(200);
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    return { userId: user.id, authorization: `Bearer ${String(login.body.accessToken)}` };
  }

  const append = (
    userId: string,
    operationKey = crypto.randomUUID(),
    entries: Array<{ bucket: 'PENDING' | 'AVAILABLE'; delta: bigint }> = [
      { bucket: 'PENDING', delta: 10n },
    ],
  ) =>
    ledger.append({
      userId,
      operationKey,
      operation: 'INTEGRATION_TEST_POSTING',
      source: 'INTEGRATION_TEST',
      sourceReference: `test-${operationKey}`,
      entries,
    });

  it('returns an authenticated zero state and exposes no public mutation route', async () => {
    await request(app.getHttpServer()).get('/api/v1/lit-points/me').expect(401);
    await request(app.getHttpServer()).get('/api/v1/lit-points/me/history').expect(401);
    const user = await actor();
    await request(app.getHttpServer())
      .get('/api/v1/lit-points/me')
      .set('Authorization', user.authorization)
      .expect(200, { pending: '0', available: '0' });
    await request(app.getHttpServer())
      .get('/api/v1/lit-points/me/history')
      .set('Authorization', user.authorization)
      .expect(200, { items: [], nextCursor: null });
    await request(app.getHttpServer())
      .post('/api/v1/lit-points/earn')
      .set('Authorization', user.authorization)
      .send({ amount: 100 })
      .expect(404);
  });

  it('derives PENDING and AVAILABLE balances exactly from integer entries', async () => {
    const user = await actor();
    await append(user.userId, crypto.randomUUID(), [
      { bucket: 'PENDING', delta: 20n },
      { bucket: 'AVAILABLE', delta: 7n },
    ]);
    await append(user.userId, crypto.randomUUID(), [
      { bucket: 'PENDING', delta: -3n },
      { bucket: 'AVAILABLE', delta: 5n },
    ]);
    expect(await ledger.balance(user.userId)).toEqual({ pending: '17', available: '12' });
    const rows = await prisma.litPointsLedgerEntry.groupBy({
      by: ['bucket'],
      where: { userId: user.userId },
      _sum: { delta: true },
    });
    expect(Object.fromEntries(rows.map((row) => [row.bucket, row._sum.delta]))).toEqual({
      PENDING: 17n,
      AVAILABLE: 12n,
    });
  });

  it('deduplicates replay, concurrent replay, and preserves distinct operations', async () => {
    const user = await actor();
    const key = crypto.randomUUID();
    const [first, second] = await Promise.all([append(user.userId, key), append(user.userId, key)]);
    expect(first.transaction.id).toBe(second.transaction.id);
    expect([first.created, second.created].sort()).toEqual([false, true]);
    await append(user.userId);
    expect(await prisma.litPointsLedgerTransaction.count({ where: { userId: user.userId } })).toBe(
      2,
    );
    expect(await ledger.balance(user.userId)).toEqual({ pending: '20', available: '0' });
    await expect(
      append(user.userId, key, [{ bucket: 'AVAILABLE', delta: 10n }]),
    ).rejects.toMatchObject({ response: { code: 'LITPOINTS_OPERATION_KEY_REUSED' } });
  });

  it('rejects UPDATE and DELETE for transactions and entries in PostgreSQL', async () => {
    const user = await actor();
    const posted = await append(user.userId);
    const entry = posted.transaction.entries[0];
    await expect(
      prisma.$executeRawUnsafe(
        `UPDATE "LitPointsLedgerEntry" SET "delta" = 2 WHERE "id" = '${entry.id}'`,
      ),
    ).rejects.toThrow('append-only');
    await expect(
      prisma.$executeRawUnsafe(`DELETE FROM "LitPointsLedgerEntry" WHERE "id" = '${entry.id}'`),
    ).rejects.toThrow('append-only');
    await expect(
      prisma.$executeRawUnsafe(
        `UPDATE "LitPointsLedgerTransaction" SET "operation" = 'X' WHERE "id" = '${posted.transaction.id}'`,
      ),
    ).rejects.toThrow('append-only');
    await expect(
      prisma.$executeRawUnsafe(
        `DELETE FROM "LitPointsLedgerTransaction" WHERE "id" = '${posted.transaction.id}'`,
      ),
    ).rejects.toThrow('append-only');
  });

  it('rolls back every entry when one entry violates a database invariant', async () => {
    const user = await actor();
    await expect(
      prisma.$transaction(async (tx) => {
        const transaction = await tx.litPointsLedgerTransaction.create({
          data: {
            userId: user.userId,
            operationKey: crypto.randomUUID(),
            operation: 'ROLLBACK_TEST',
            source: 'INTEGRATION_TEST',
            sourceReference: 'rollback',
            requestHash: 'rollback-test',
          },
        });
        await tx.litPointsLedgerEntry.create({
          data: {
            transactionId: transaction.id,
            userId: user.userId,
            bucket: 'PENDING',
            delta: 1n,
          },
        });
        await tx.litPointsLedgerEntry.create({
          data: {
            transactionId: transaction.id,
            userId: user.userId,
            bucket: 'AVAILABLE',
            delta: 0n,
          },
        });
      }),
    ).rejects.toThrow();
    expect(await prisma.litPointsLedgerTransaction.count()).toBe(0);
    expect(await prisma.litPointsLedgerEntry.count()).toBe(0);
  });

  it('paginates safe history without changing balance and prevents IDOR', async () => {
    const owner = await actor();
    const other = await actor();
    await append(owner.userId, crypto.randomUUID(), [{ bucket: 'PENDING', delta: 4n }]);
    await append(owner.userId, crypto.randomUUID(), [{ bucket: 'AVAILABLE', delta: 6n }]);
    await append(other.userId, crypto.randomUUID(), [{ bucket: 'AVAILABLE', delta: 999n }]);
    const first = await request(app.getHttpServer())
      .get('/api/v1/lit-points/me/history?limit=1')
      .set('Authorization', owner.authorization)
      .expect(200);
    expect(first.body.items).toHaveLength(1);
    expect(first.body.items[0]).not.toHaveProperty('userId');
    expect(first.body.items[0]).not.toHaveProperty('operationKey');
    const second = await request(app.getHttpServer())
      .get(`/api/v1/lit-points/me/history?limit=1&cursor=${String(first.body.nextCursor)}`)
      .set('Authorization', owner.authorization)
      .expect(200);
    expect(second.body.items).toHaveLength(1);
    expect([...first.body.items, ...second.body.items]).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ delta: '999' })]),
    );
    await request(app.getHttpServer())
      .get(`/api/v1/lit-points/me/history?userId=${other.userId}`)
      .set('Authorization', owner.authorization)
      .expect(400);
    expect(await ledger.balance(owner.userId)).toEqual({ pending: '4', available: '6' });
  });
});
