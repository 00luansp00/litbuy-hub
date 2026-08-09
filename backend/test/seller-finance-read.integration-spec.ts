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
import { CartsService } from '../src/carts/carts.service';
import { parseIdempotencyKey } from '../src/commerce/idempotency-key';
import { CheckoutService } from '../src/checkout/checkout.service';
import { SaleFinancialRecognitionService } from '../src/financial/sale-financial-recognition.service';
import { SellerHeldFundsReleaseService } from '../src/financial/seller-held-funds-release.service';
import { SellerHoldEligibilityService } from '../src/financial/seller-hold-eligibility.service';
import { SellerPendingHoldService } from '../src/financial/seller-pending-hold.service';
import { OrderFulfillmentService } from '../src/orders/order-fulfillment.service';
import { PaidOrderActivationService } from '../src/orders/paid-order-activation.service';
import { commerceFixture, publishPlatformCommissionPolicy } from './order-checkout-test.helpers';

const password = 'seller finance integration password 123';
type Actor = { userId: string; authorization: string };

describe('Seller finance read HTTP with real auth and PostgreSQL', () => {
  jest.setTimeout(120_000);
  let app: INestApplication;
  let prisma: PrismaService;
  let ledger: FinancialLedgerService;
  let mailer: AuthMailer;
  let redis: RedisService;
  let policyVersion = 90_000;

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
    const recognized = await post('SALE_RECOGNIZED', [
      { accountId: clearing, direction: 'DEBIT', amountMinor: amount },
      { accountId: account('SELLER_PENDING'), direction: 'CREDIT', amountMinor: amount },
    ]);
    const held = await post('SELLER_FUNDS_HELD', [
      { accountId: account('SELLER_PENDING'), direction: 'DEBIT', amountMinor: amount },
      { accountId: account('SELLER_HELD'), direction: 'CREDIT', amountMinor: amount },
    ]);
    const released = await post('SELLER_FUNDS_RELEASED', [
      { accountId: account('SELLER_HELD'), direction: 'DEBIT', amountMinor: amount },
      { accountId: account('SELLER_AVAILABLE'), direction: 'CREDIT', amountMinor: amount },
    ]);
    return { recognized, held, released };
  }

  const balances = (pending: string, held: string, available: string) => ({
    pendingMinor: pending,
    heldMinor: held,
    availableMinor: available,
    reservedMinor: '0',
    deficitMinor: '0',
  });

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
    const postingsA = await postFlow(a, 9000n);
    await postFlow(b, 4000n);
    const persisted = await prisma.ledgerTransaction.findMany({
      where: {
        id: { in: [postingsA.recognized.id, postingsA.held.id, postingsA.released.id] },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { id: true, createdAt: true },
    });
    expect(persisted).toHaveLength(3);
    const expected = persisted.map(({ id }) => id);
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
    const page1 = first.body.items as Array<{ id: string }>;
    expect(page1.map((item) => item.id)).toEqual(expected.slice(0, 2));
    const second = await request(app.getHttpServer())
      .get(
        `/api/v1/seller/finance/activity?limit=2&cursor=${encodeURIComponent(String(first.body.nextCursor))}`,
      )
      .set('Authorization', a.authorization)
      .expect(200);
    const page2 = second.body.items as Array<{ id: string }>;
    const all = [...page1, ...page2] as Record<string, unknown>[];
    expect(page2.map((item) => item.id)).toEqual(expected.slice(2));
    expect(all.map((item) => item.id)).toEqual(expected);
    expect(new Set(all.map((item) => item.id)).size).toBe(3);
    expect(new Set(all.map((item) => item.id))).toEqual(new Set(expected));
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

  it('exposes pending, held, and available checkpoints from the real commerce chain', async () => {
    const sellerActor = await actor(true, 'NONE');
    const fixture = await commerceFixture(prisma, 'NORMAL', undefined, 20, false);
    await prisma.sellerProfile.update({
      where: { id: fixture.seller.id },
      data: { userId: sellerActor.userId },
    });
    await publishPlatformCommissionPolicy(prisma, sellerActor.userId, {
      publicVersion: policyVersion++,
      fixedAmountMinor: 1000n,
    });

    const carts = app.get(CartsService);
    const checkout = app.get(CheckoutService);
    const activation = app.get(PaidOrderActivationService);
    const recognition = app.get(SaleFinancialRecognitionService);
    const fulfillment = app.get(OrderFulfillmentService);
    const pendingHold = app.get(SellerPendingHoldService);
    const eligibility = app.get(SellerHoldEligibilityService);
    const release = app.get(SellerHeldFundsReleaseService);
    const cart = await carts.add(fixture.buyer.id, fixture.seller.slug, {
      productId: fixture.product.id,
      quantity: 10,
      expectedVersion: 0,
    });
    const checkoutResult = await checkout.create(
      fixture.buyer.id,
      parseIdempotencyKey(`seller-finance-read:${crypto.randomUUID()}`),
      {
        sellerSlug: fixture.seller.slug,
        expectedCartVersion: cart.version,
        expectedPreviewFingerprint: cart.previewFingerprint,
      },
    );
    const order = await prisma.order.findUniqueOrThrow({
      where: { publicCode: (checkoutResult as { orderCode: string }).orderCode },
    });
    expect(order.totalAmountMinor).toBe(10_000n);
    const payment = await prisma.payment.create({
      data: {
        orderId: order.id,
        amountMinor: order.totalAmountMinor,
        status: 'PAID',
        paidAt: new Date(),
      },
    });
    await prisma.paymentAttempt.create({
      data: {
        paymentId: payment.id,
        attemptNumber: 1,
        providerCode: 'LOCAL_TEST',
        status: 'SUCCEEDED',
        amountMinor: payment.amountMinor,
        externalPaymentId: `pay-${crypto.randomUUID()}`,
        idempotencyKeyHash: crypto.randomUUID(),
        requestHash: crypto.randomUUID(),
      },
    });
    await prisma.order.update({ where: { id: order.id }, data: { paymentStatus: 'PENDING' } });
    expect(await activation.processOne(order.id)).toBe(true);
    expect(await recognition.processOne(order.id)).toBe(true);

    const summary = () =>
      request(app.getHttpServer())
        .get('/api/v1/seller/finance/summary')
        .set('Authorization', sellerActor.authorization)
        .expect(200);
    expect((await summary()).body.balances).toEqual(balances('9000', '0', '0'));

    await fulfillment.makeAvailable(order.id);
    await fulfillment.recordDelivered({
      orderCode: order.publicCode,
      actorUserId: sellerActor.userId,
      deliveryType: 'MANUAL_REFERENCE',
      evidenceHash: 'a'.repeat(64),
    });
    await fulfillment.confirmReceipt(order.publicCode, fixture.buyer.id);
    const draftPolicy = await prisma.sellerReleasePolicyVersion.create({
      data: {
        publicVersion: policyVersion++,
        effectiveFrom: new Date(Date.now() - 60_000),
        createdByUserId: sellerActor.userId,
        rules: { create: { code: 'DELIVERY_PROTECTION_DEFAULT', delayHours: 0, enabled: true } },
      },
    });
    await prisma.sellerReleasePolicyVersion.update({
      where: { id: draftPolicy.id },
      data: {
        status: 'ACTIVE',
        publishedByUserId: sellerActor.userId,
        publishedAt: new Date(),
      },
    });
    expect(await pendingHold.processOne(order.id)).toBe('PROCESSED');
    expect((await summary()).body.balances).toEqual(balances('0', '9000', '0'));
    const hold = await prisma.financialHold.findFirstOrThrow({ where: { orderId: order.id } });
    expect(await eligibility.processOne(hold.id)).toBe('RELEASE_ELIGIBLE');
    expect(await release.processOne(hold.id)).toBe('RELEASED');
    expect((await summary()).body.balances).toEqual(balances('0', '0', '9000'));

    const activity = await request(app.getHttpServer())
      .get('/api/v1/seller/finance/activity')
      .set('Authorization', sellerActor.authorization)
      .expect(200);
    const activityItems = activity.body.items as Array<{
      type: string;
      movements: Record<string, string>;
    }>;
    expect(activityItems).toHaveLength(3);
    expect(new Set(activityItems.map((item) => item.type))).toEqual(
      new Set(['SALE_RECOGNIZED', 'SELLER_FUNDS_HELD', 'SELLER_FUNDS_RELEASED']),
    );
    const released = activityItems.find((item) => item.type === 'SELLER_FUNDS_RELEASED');
    expect(released?.movements).toEqual(balances('0', '-9000', '9000'));
    for (const item of activityItems) {
      expect(item).not.toHaveProperty('entries');
      expect(item).not.toHaveProperty('accountId');
      expect(Object.values(item.movements).every((value) => typeof value === 'string')).toBe(true);
    }
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