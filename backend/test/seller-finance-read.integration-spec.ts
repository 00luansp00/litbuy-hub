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
import { RedisService } from '../src/redis/redis.service';
import { FinancialLedgerService } from '../src/financial/financial-ledger.service';

const password = 'seller finance integration password 123';
type Actor = { userId: string; authorization: string };

describe('Seller finance read HTTP with real auth and PostgreSQL', () => {
  jest.setTimeout(120_000);
  let app: INestApplication;
  let prisma: PrismaService;
  let ledger: FinancialLedgerService;
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
    ledger = app.get(FinancialLedgerService);
    mailer = app.get(AuthMailer);
    redis = app.get(RedisService);
  });

  beforeEach(async () => {
    await (await redis.getClient()).flushdb();
    mailer.sent.splice(0);
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "User" CASCADE');
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "LedgerAccount" CASCADE');
  });
  afterAll(() => app.close());

  async function actor(
    role = true,
    profile: 'ACTIVE' | 'SUSPENDED' | 'NONE' = 'ACTIVE',
  ): Promise<Actor> {
    const email = `finance-${crypto.randomUUID()}@example.test`;
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
    if (role) await prisma.userRoleAssignment.create({ data: { userId: user.id, role: 'SELLER' } });
    if (profile !== 'NONE')
      await prisma.sellerProfile.create({
        data: {
          userId: user.id,
          storeName: email,
          slug: `finance-${crypto.randomUUID()}`,
          status: profile,
        },
      });
    return { userId: user.id, authorization: `Bearer ${String(login.body.accessToken)}` };
  }

  async function postFlow(actor: Actor, amount: bigint) {
    const seller = await prisma.sellerProfile.findUniqueOrThrow({
      where: { userId: actor.userId },
    });
    const sellerAccounts = await ledger.ensureSellerLedgerAccounts(seller.id);
    const system = await ledger.ensureSystemLedgerAccounts();
    const account = (purpose: string) => sellerAccounts.find((a) => a.purpose === purpose)!.id;
    const clearing = system.find((a) => a.purpose === 'PROVIDER_CLEARING')!.id;
    const post = (
      type: string,
      entries: { accountId: string; direction: 'DEBIT' | 'CREDIT'; amountMinor: bigint }[],
    ) => ledger.post({ type, currency: 'BRL', idempotencyKeyHash: crypto.randomUUID(), entries });
    await post('SALE_RECOGNIZED', [
      { accountId: clearing, direction: 'DEBIT', amountMinor: amount },
      { accountId: account('SELLER_PENDING'), direction: 'CREDIT', amountMinor: amount },
    ]);
    await post('SELLER_FUNDS_HELD', [
      { accountId: account('SELLER_PENDING'), direction: 'DEBIT', amountMinor: amount },
      { accountId: account('SELLER_HELD'), direction: 'CREDIT', amountMinor: amount },
    ]);
    await post('SELLER_FUNDS_RELEASED', [
      { accountId: account('SELLER_HELD'), direction: 'DEBIT', amountMinor: amount },
      { accountId: account('SELLER_AVAILABLE'), direction: 'CREDIT', amountMinor: amount },
    ]);
  }

  it('requires authentication, SELLER role, and an ACTIVE persistent profile', async () => {
    await request(app.getHttpServer()).get('/api/v1/seller/finance/summary').expect(401);
    await request(app.getHttpServer()).get('/api/v1/seller/finance/activity').expect(401);
    const buyer = await actor(false, 'ACTIVE');
    await request(app.getHttpServer())
      .get('/api/v1/seller/finance/summary')
      .set('Authorization', buyer.authorization)
      .expect(403);
    const noProfile = await actor(true, 'NONE');
    await request(app.getHttpServer())
      .get('/api/v1/seller/finance/summary')
      .set('Authorization', noProfile.authorization)
      .expect(404);
    const suspended = await actor(true, 'SUSPENDED');
    await request(app.getHttpServer())
      .get('/api/v1/seller/finance/summary')
      .set('Authorization', suspended.authorization)
      .expect(404);
  });

  it('returns zero strings without provisioning accounts or financial artifacts', async () => {
    const seller = await actor();
    const before = await counts();
    const response = await request(app.getHttpServer())
      .get('/api/v1/seller/finance/summary')
      .set('Authorization', seller.authorization)
      .expect(200);
    expect(response.body).toEqual({
      currency: 'BRL',
      balances: {
        pendingMinor: '0',
        heldMinor: '0',
        availableMinor: '0',
        reservedMinor: '0',
        deficitMinor: '0',
      },
    });
    expect(await counts()).toEqual(before);
  });

  it('isolates sellers, aggregates only seller entries, paginates, and remains read-only', async () => {
    const a = await actor();
    const b = await actor();
    await postFlow(a, 9000n);
    await postFlow(b, 4000n);
    const before = await counts();
    const summaryA = await request(app.getHttpServer())
      .get('/api/v1/seller/finance/summary')
      .set('Authorization', a.authorization)
      .expect(200);
    const summaryB = await request(app.getHttpServer())
      .get('/api/v1/seller/finance/summary')
      .set('Authorization', b.authorization)
      .expect(200);
    expect(summaryA.body.balances.availableMinor).toBe('9000');
    expect(summaryB.body.balances.availableMinor).toBe('4000');
    const first = await request(app.getHttpServer())
      .get('/api/v1/seller/finance/activity?limit=2')
      .set('Authorization', a.authorization)
      .expect(200);
    expect(first.body.items).toHaveLength(2);
    expect(typeof first.body.nextCursor).toBe('string');
    const second = await request(app.getHttpServer())
      .get(
        `/api/v1/seller/finance/activity?limit=2&cursor=${encodeURIComponent(String(first.body.nextCursor))}`,
      )
      .set('Authorization', a.authorization)
      .expect(200);
    const all = [...first.body.items, ...second.body.items] as Record<string, unknown>[];
    expect(new Set(all.map((item) => item.id)).size).toBe(3);
    expect(all.map((item) => item.type)).toEqual(
      expect.arrayContaining(['SALE_RECOGNIZED', 'SELLER_FUNDS_HELD', 'SELLER_FUNDS_RELEASED']),
    );
    const released = all.find((item) => item.type === 'SELLER_FUNDS_RELEASED') as {
      movements: Record<string, unknown>;
    };
    expect(released.movements).toEqual({
      pendingMinor: '0',
      heldMinor: '-9000',
      availableMinor: '9000',
      reservedMinor: '0',
      deficitMinor: '0',
    });
    for (const item of all) {
      expect(item).not.toHaveProperty('entries');
      expect(item).not.toHaveProperty('accountId');
      for (const value of Object.values(item.movements as object))
        expect(typeof value).toBe('string');
    }
    expect(await counts()).toEqual(before);
    await request(app.getHttpServer())
      .get(`/api/v1/seller/finance/summary?sellerProfileId=${crypto.randomUUID()}`)
      .set('Authorization', a.authorization)
      .expect(400);
  });

  it.each([
    'not-base64-json',
    Buffer.from('{}').toString('base64url'),
    Buffer.from(JSON.stringify({ id: crypto.randomUUID(), createdAt: 'bad' })).toString(
      'base64url',
    ),
  ])('rejects invalid cursor %s', async (cursor) => {
    const seller = await actor();
    await request(app.getHttpServer())
      .get(`/api/v1/seller/finance/activity?cursor=${encodeURIComponent(cursor)}`)
      .set('Authorization', seller.authorization)
      .expect(400);
  });

  async function counts() {
    const [
      ledgerAccount,
      ledgerTransaction,
      ledgerEntry,
      financialEvent,
      financialOutboxEvent,
      financialHold,
      payment,
      order,
    ] = await Promise.all([
      prisma.ledgerAccount.count(),
      prisma.ledgerTransaction.count(),
      prisma.ledgerEntry.count(),
      prisma.financialEvent.count(),
      prisma.financialOutboxEvent.count(),
      prisma.financialHold.count(),
      prisma.payment.count(),
      prisma.order.count(),
    ]);
    return {
      ledgerAccount,
      ledgerTransaction,
      ledgerEntry,
      financialEvent,
      financialOutboxEvent,
      financialHold,
      payment,
      order,
    };
  }
});
