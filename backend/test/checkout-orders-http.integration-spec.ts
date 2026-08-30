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
import {
  SaleFinancialRecognitionService,
  saleRecognitionIdempotencyKey,
} from '../src/financial/sale-financial-recognition.service';
import { OrderFulfillmentService } from '../src/orders/order-fulfillment.service';
import { PaidOrderActivationService } from '../src/orders/paid-order-activation.service';
import { RedisService } from '../src/redis/redis.service';
import { DisputeCoreService } from '../src/disputes/dispute-core.service';
import { authHeaders, commerceFixture, createActor } from './order-checkout-test.helpers';

describe('Checkout and orders HTTP with real auth, guards, CSRF and PostgreSQL', () => {
  jest.setTimeout(120_000);
  let app: INestApplication, prisma: PrismaService, mailer: AuthMailer, redis: RedisService;
  let activation: PaidOrderActivationService;
  let recognition: SaleFinancialRecognitionService;
  let fulfillment: OrderFulfillmentService;
  let disputes: DisputeCoreService;
  beforeAll(async () => {
    process.env.PAYMENT_PROVIDER_MODE = 'FAKE_ALPHA';
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
    mailer = app.get(AuthMailer);
    redis = app.get(RedisService);
    activation = app.get(PaidOrderActivationService);
    recognition = app.get(SaleFinancialRecognitionService);
    fulfillment = app.get(OrderFulfillmentService);
    disputes = app.get(DisputeCoreService);
  });
  beforeEach(async () => {
    await (await redis.getClient()).flushdb();
    mailer.sent.splice(0);
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "User", "CatalogCategory" CASCADE');
  });
  afterAll(async () => {
    await app.close();
  });
  async function cart(
    actor: Awaited<ReturnType<typeof createActor>>,
    model: 'NORMAL' | 'SERVICE' = 'NORMAL',
    pricing?: 'FIXED' | 'QUOTE',
  ) {
    const f = await commerceFixture(prisma, model, pricing);
    if (model === 'SERVICE' && pricing === 'QUOTE') {
      const stored = await prisma.cart.create({
        data: {
          buyerUserId: actor.user.id,
          sellerProfileId: f.seller.id,
          items: { create: { productId: f.product.id, quantity: 1 } },
        },
      });
      return {
        ...f,
        preview: {
          id: stored.id,
          version: 1,
          previewFingerprint: 'sha256:'.padEnd(71, '0'),
          buyerVipPreviewFingerprints: {
            NONE: 'sha256:'.padEnd(71, '0'),
            BASIC: 'sha256:'.padEnd(71, '0'),
            PREMIUM: 'sha256:'.padEnd(71, '0'),
          },
        },
      };
    }
    const added = await request(app.getHttpServer())
      .post(`/api/v1/carts/${f.seller.slug}/items`)
      .set(authHeaders(actor))
      .send({ productId: f.product.id, quantity: 1, expectedVersion: 0 })
      .expect(201);
    return {
      ...f,
      preview: added.body as {
        id: string;
        version: number;
        previewFingerprint: string;
        buyerVipPreviewFingerprints: Record<'NONE' | 'BASIC' | 'PREMIUM', string>;
      },
    };
  }
  const body = (f: Awaited<ReturnType<typeof cart>>) => ({
    sellerSlug: f.seller.slug,
    expectedCartVersion: f.preview.version,
    buyerVipPlan: 'NONE',
    expectedPreviewFingerprint: f.preview.buyerVipPreviewFingerprints.NONE,
  });
  const checkout = (
    actor: Awaited<ReturnType<typeof createActor>>,
    f: Awaited<ReturnType<typeof cart>>,
    idempotencyKey = `checkout:${crypto.randomUUID()}`,
  ) =>
    request(app.getHttpServer())
      .post('/api/v1/checkout-sessions')
      .set(authHeaders(actor))
      .set('Idempotency-Key', idempotencyKey)
      .send(body(f));

  async function awaitingConfirmation(owner: Awaited<ReturnType<typeof createActor>>) {
    const f = await cart(owner);
    const created = await checkout(owner, f).expect(201);
    const order = await prisma.order.findUniqueOrThrow({
      where: { publicCode: String(created.body.orderCode) },
    });
    await prisma.order.update({ where: { id: order.id }, data: { buyerUserId: owner.user.id } });
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
    await activation.processOne(order.id);
    await recognition.processOne(order.id);
    await fulfillment.makeAvailable(order.id);
    await fulfillment.recordDelivered({
      orderCode: order.publicCode,
      actorUserId: f.sellerUser.id,
      deliveryType: 'MANUAL_REFERENCE',
      evidenceHash: 'a'.repeat(64),
    });
    return { order: await prisma.order.findUniqueOrThrow({ where: { id: order.id } }), f };
  }

  const confirm = (owner: Awaited<ReturnType<typeof createActor>>, orderCode: string) =>
    request(app.getHttpServer())
      .post(`/api/v1/orders/${orderCode}/fulfillment/confirm`)
      .set(authHeaders(owner));

  it('lets only the owning Buyer report for life and reads persistent case history without financial effects', async () => {
    const owner = await createActor(app, prisma, mailer);
    const other = await createActor(app, prisma, mailer);
    const f = await cart(owner);
    const created = await checkout(owner, f).expect(201);
    const orderCode = String(created.body.orderCode);
    const order = await prisma.order.findUniqueOrThrow({ where: { publicCode: orderCode } });
    const old = new Date('2020-01-01T00:00:00.000Z');
    await prisma.order.update({
      where: { id: order.id },
      data: { createdAt: old, sellerMaxEffectiveReleaseAt: old },
    });
    const financialBefore = {
      ledger: await prisma.ledgerTransaction.count(),
      holds: await prisma.financialHold.count(),
      refunds: await prisma.refund.count(),
      available: await prisma.ledgerEntry.count({
        where: { account: { purpose: 'SELLER_AVAILABLE' } },
      }),
    };

    await request(app.getHttpServer())
      .post(`/api/v1/orders/${orderCode}/report-problem`)
      .set(authHeaders(other))
      .expect(404);
    await request(app.getHttpServer())
      .get(`/api/v1/orders/${orderCode}`)
      .set(authHeaders(other, false))
      .expect(404);
    await request(app.getHttpServer())
      .post(`/api/v1/orders/${orderCode}/report-problem`)
      .set(authHeaders(owner, false))
      .expect(401);

    const response = await request(app.getHttpServer())
      .post(`/api/v1/orders/${orderCode}/report-problem`)
      .set(authHeaders(owner))
      .send({ actorUserId: other.user.id })
      .expect(200);
    expect(response.body.disputeCases).toEqual([
      expect.objectContaining({ status: 'OPEN', terminalAt: null }),
    ]);
    const first = await prisma.disputeCase.findFirstOrThrow({
      where: { orderId: order.id },
      include: { events: true },
    });
    expect(first.events).toEqual([
      expect.objectContaining({ type: 'CASE_OPENED', actorUserId: owner.user.id }),
    ]);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).disputeStatus).toBe(
      'NONE',
    );
    await request(app.getHttpServer())
      .post(`/api/v1/orders/${orderCode}/report-problem`)
      .set(authHeaders(owner))
      .expect(409);
    expect(await prisma.disputeCase.count({ where: { orderId: order.id } })).toBe(1);

    await disputes.transition({ caseId: first.id, toStatus: 'CLOSED', actorUserId: owner.user.id });
    await request(app.getHttpServer())
      .post(`/api/v1/orders/${orderCode}/report-problem`)
      .set(authHeaders(owner))
      .expect(200);
    const refreshed = await request(app.getHttpServer())
      .get(`/api/v1/orders/${orderCode}`)
      .set(authHeaders(owner, false))
      .expect(200);
    const refreshedCases = refreshed.body.disputeCases as Array<{ status: string }>;
    expect(refreshedCases.map((item) => item.status)).toEqual(['OPEN', 'CLOSED']);
    expect(await prisma.disputeCase.count({ where: { orderId: order.id } })).toBe(2);
    expect({
      ledger: await prisma.ledgerTransaction.count(),
      holds: await prisma.financialHold.count(),
      refunds: await prisma.refund.count(),
      available: await prisma.ledgerEntry.count({
        where: { account: { purpose: 'SELLER_AVAILABLE' } },
      }),
    }).toEqual(financialBefore);
  });

  it('composes the real FAKE_ALPHA path through recognition before seller availability', async () => {
    const owner = await createActor(app, prisma, mailer);
    const f = await cart(owner);
    const created = await checkout(owner, f).expect(201);
    const orderCode = String(created.body.orderCode);
    const initiate = await request(app.getHttpServer())
      .post(`/api/v1/orders/${orderCode}/payment-attempts`)
      .set(authHeaders(owner))
      .set('Idempotency-Key', `payment:${crypto.randomUUID()}`)
      .expect(201);
    const confirmationKey = `alpha-confirm:${crypto.randomUUID()}`;
    const alphaConfirm = () =>
      request(app.getHttpServer())
        .post(
          `/api/v1/orders/${orderCode}/payment-attempts/${String(initiate.body.attemptId)}/alpha-confirm`,
        )
        .set(authHeaders(owner))
        .set('Idempotency-Key', confirmationKey);

    await alphaConfirm().expect(200);
    await alphaConfirm().expect(200);

    const order = await prisma.order.findUniqueOrThrow({ where: { publicCode: orderCode } });
    const payment = await prisma.payment.findUniqueOrThrow({ where: { orderId: order.id } });
    const attempt = await prisma.paymentAttempt.findUniqueOrThrow({
      where: { id: String(initiate.body.attemptId) },
    });
    expect(attempt.status).toBe('SUCCEEDED');
    expect(payment.status).toBe('PAID');
    expect(order).toMatchObject({
      status: 'ACTIVE',
      paymentStatus: 'PAID',
      fulfillmentStatus: 'AWAITING_SELLER',
    });

    const recognitions = await prisma.ledgerTransaction.findMany({
      where: { type: 'SALE_RECOGNIZED', referenceType: 'OrderSale', referenceId: order.id },
      include: { entries: { include: { account: true } } },
    });
    expect(recognitions).toHaveLength(1);
    expect(recognitions[0].idempotencyKeyHash).toBe(saleRecognitionIdempotencyKey(order.id));
    const debits = recognitions[0].entries
      .filter(({ direction }) => direction === 'DEBIT')
      .reduce((sum, { amountMinor }) => sum + amountMinor, 0n);
    const credits = recognitions[0].entries
      .filter(({ direction }) => direction === 'CREDIT')
      .reduce((sum, { amountMinor }) => sum + amountMinor, 0n);
    expect(debits).toBe(credits);
    expect(
      recognitions[0].entries.find(({ account }) => account.purpose === 'SELLER_PENDING')
        ?.amountMinor,
    ).toBe(order.totalAmountMinor - order.platformFeeAmountMinor);
    expect(
      recognitions[0].entries.find(({ account }) => account.purpose === 'PLATFORM_COMMISSION')
        ?.amountMinor,
    ).toBe(order.platformFeeAmountMinor || undefined);
    expect(
      recognitions[0].entries.some(({ account }) =>
        ['SELLER_HELD', 'SELLER_AVAILABLE'].includes(account.purpose),
      ),
    ).toBe(false);

    await fulfillment.recordDelivered({
      orderCode,
      actorUserId: f.sellerUser.id,
      deliveryType: 'MANUAL_REFERENCE',
      evidenceHash: 'a'.repeat(64),
    });
    await confirm(owner, orderCode).expect(200);
    expect(await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).toMatchObject({
      status: 'COMPLETED',
      fulfillmentStatus: 'CONFIRMED',
    });
    expect(
      await prisma.ledgerTransaction.count({
        where: { type: 'SALE_RECOGNIZED', referenceType: 'OrderSale', referenceId: order.id },
      }),
    ).toBe(1);
    expect(
      await prisma.reconciliationIssue.count({
        where: {
          referenceId: order.id,
          details: { path: ['errorCode'], equals: 'SALE_RECOGNITION_MISSING' },
        },
      }),
    ).toBe(0);
  });
  it('enforces anonymous access, BUYER RBAC and persisted-session CSRF', async () => {
    const actor = await createActor(app, prisma, mailer),
      other = await createActor(app, prisma, mailer),
      f = await cart(actor);
    await request(app.getHttpServer()).post('/api/v1/checkout-sessions').send(body(f)).expect(401);
    await checkout(actor, f).set('X-CSRF-Token', '').expect(401);
    await checkout(actor, f).set('X-CSRF-Token', 'incorrect').expect(401);
    await checkout(actor, f).set('X-CSRF-Token', other.csrf).expect(401);
    await prisma.userRoleAssignment.delete({
      where: { userId_role: { userId: actor.user.id, role: 'BUYER' } },
    });
    await prisma.userRoleAssignment.create({ data: { userId: actor.user.id, role: 'ADMIN' } });
    await checkout(actor, f).expect(403);
    await prisma.userRoleAssignment.create({ data: { userId: actor.user.id, role: 'BUYER' } });
    await checkout(actor, f).expect(201);
  });
  it('validates version, fingerprint, idempotency headers and safe checkout responses', async () => {
    const actor = await createActor(app, prisma, mailer),
      f = await cart(actor);
    await request(app.getHttpServer())
      .post('/api/v1/checkout-sessions')
      .set(authHeaders(actor))
      .send(body(f))
      .expect(400)
      .expect(({ body: response }) => expect(response.code).toBe('IDEMPOTENCY_KEY_REQUIRED'));
    await request(app.getHttpServer())
      .post('/api/v1/checkout-sessions')
      .set(authHeaders(actor))
      .set('Idempotency-Key', 'short')
      .send(body(f))
      .expect(400);
    await checkout(actor, f)
      .send({ ...body(f), expectedCartVersion: 99 })
      .expect(409)
      .expect(({ body: response }) => expect(response.code).toBe('CART_VERSION_CONFLICT'));
    await checkout(actor, f)
      .send({ ...body(f), expectedPreviewFingerprint: 'sha256:'.padEnd(71, '0') })
      .expect(409)
      .expect(({ body: response }) => expect(response.code).toBe('CHECKOUT_PREVIEW_CHANGED'));
    const key = `checkout:${crypto.randomUUID()}`;
    const first = await checkout(actor, f, key).expect(201);
    const replay = await checkout(actor, f, key).expect(201);
    expect(replay.body).toEqual(first.body);
    expect(first.body).toMatchObject({
      totalAmountMinor: expect.any(String),
      items: [{ unitAmountMinor: expect.any(String) }],
    });
    const serialized = JSON.stringify(first.body);
    for (const field of [
      'objectKey',
      'accountDetails',
      'csrfTokenHash',
      'sessionId',
      'keyHash',
      'reservation',
      'outbox',
      'securityEvent',
    ])
      expect(serialized).not.toContain(field);
    await checkout(actor, f, key)
      .send({ ...body(f), expectedCartVersion: 2 })
      .expect(409)
      .expect(({ body: response }) => expect(response.code).toBe('IDEMPOTENCY_KEY_REUSED'));
    expect(await prisma.cart.findUniqueOrThrow({ where: { id: f.preview.id } })).toMatchObject({
      status: 'CHECKED_OUT',
      version: 2,
    });
  });
  it('reuses one response for simultaneous identical HTTP requests', async () => {
    const actor = await createActor(app, prisma, mailer),
      f = await cart(actor),
      key = `checkout:${crypto.randomUUID()}`;
    const responses = await Promise.all([checkout(actor, f, key), checkout(actor, f, key)]);
    expect(responses.map((value) => value.status)).toEqual([201, 201]);
    expect(responses[0].body).toEqual(responses[1].body);
    expect(await prisma.order.count()).toBe(1);
    expect(await prisma.commerceIdempotencyRecord.count()).toBe(1);
  });
  it('lists and reads only owner snapshots and cancels idempotently with HTTP 200', async () => {
    const owner = await createActor(app, prisma, mailer),
      intruder = await createActor(app, prisma, mailer),
      f = await cart(owner);
    const created = await checkout(owner, f).expect(201);
    const code = String(created.body.orderCode);
    const list = await request(app.getHttpServer())
      .get('/api/v1/orders')
      .set('Authorization', owner.authorization)
      .expect(200);
    expect(list.body.items).toHaveLength(1);
    await request(app.getHttpServer())
      .get(`/api/v1/orders/${code}`)
      .set('Authorization', owner.authorization)
      .expect(200);
    await request(app.getHttpServer())
      .get(`/api/v1/orders/${code}`)
      .set('Authorization', intruder.authorization)
      .expect(404);
    const key = `cancel:${crypto.randomUUID()}`;
    const endpoint = `/api/v1/orders/${code}/cancel`;
    await request(app.getHttpServer())
      .post(endpoint)
      .set(authHeaders(owner))
      .set('Idempotency-Key', key)
      .send({ expectedVersion: 99 })
      .expect(409);
    const cancelled = await request(app.getHttpServer())
      .post(endpoint)
      .set(authHeaders(owner))
      .set('Idempotency-Key', key)
      .send({ expectedVersion: 1 })
      .expect(200);
    expect(cancelled.body).toMatchObject({ status: 'CANCELLED', version: 2 });
    await request(app.getHttpServer())
      .post(endpoint)
      .set(authHeaders(owner))
      .set('Idempotency-Key', key)
      .send({ expectedVersion: 1 })
      .expect(200);
    await request(app.getHttpServer())
      .post(endpoint)
      .set(authHeaders(owner))
      .set('Idempotency-Key', `cancel:${crypto.randomUUID()}`)
      .send({ expectedVersion: 1 })
      .expect(200);
    await request(app.getHttpServer())
      .post(endpoint)
      .set(authHeaders(owner))
      .set('Idempotency-Key', key)
      .send({ expectedVersion: 2 })
      .expect(409)
      .expect(({ body: response }) => expect(response.code).toBe('IDEMPOTENCY_KEY_REUSED'));
    expect(await prisma.orderEvent.count({ where: { type: 'ORDER_CANCELLED' } })).toBe(1);
  });
  it('rejects empty, missing and QUOTE carts without partial orders', async () => {
    const actor = await createActor(app, prisma, mailer),
      missing = await commerceFixture(prisma),
      quote = await cart(actor, 'SERVICE', 'QUOTE');
    await request(app.getHttpServer())
      .post('/api/v1/checkout-sessions')
      .set(authHeaders(actor))
      .set('Idempotency-Key', `checkout:${crypto.randomUUID()}`)
      .send({
        sellerSlug: missing.seller.slug,
        expectedCartVersion: 1,
        buyerVipPlan: 'NONE',
        expectedPreviewFingerprint: 'sha256:'.padEnd(71, '0'),
      })
      .expect(422);
    const emptySeller = await commerceFixture(prisma);
    await prisma.cart.create({
      data: { buyerUserId: actor.user.id, sellerProfileId: emptySeller.seller.id },
    });
    const empty = await request(app.getHttpServer())
      .get(`/api/v1/carts/${emptySeller.seller.slug}`)
      .set('Authorization', actor.authorization)
      .expect(200);
    await request(app.getHttpServer())
      .post('/api/v1/checkout-sessions')
      .set(authHeaders(actor))
      .set('Idempotency-Key', `checkout:${crypto.randomUUID()}`)
      .send({
        sellerSlug: emptySeller.seller.slug,
        expectedCartVersion: empty.body.version,
        buyerVipPlan: 'NONE',
        expectedPreviewFingerprint: empty.body.previewFingerprint,
      })
      .expect(422)
      .expect(({ body: response }) => expect(response.code).toBe('CART_EMPTY'));
    await checkout(actor, quote).expect(422);
    expect(await prisma.order.count()).toBe(0);
  });

  it('protects buyer receipt confirmation with auth, BUYER RBAC, CSRF and IDOR-safe lookup', async () => {
    const owner = await createActor(app, prisma, mailer);
    const intruder = await createActor(app, prisma, mailer);
    const { order } = await awaitingConfirmation(owner);
    const endpoint = `/api/v1/orders/${order.publicCode}/fulfillment/confirm`;
    await request(app.getHttpServer()).post(endpoint).expect(401);
    await request(app.getHttpServer()).post(endpoint).set(authHeaders(owner, false)).expect(401);
    await request(app.getHttpServer())
      .post(endpoint)
      .set(authHeaders(owner))
      .set('X-CSRF-Token', 'invalid')
      .expect(401);
    await confirm(intruder, order.publicCode).expect(404);
    await confirm(owner, 'LIT-00000000000000').expect(404);
    await prisma.userRoleAssignment.delete({
      where: { userId_role: { userId: owner.user.id, role: 'BUYER' } },
    });
    await prisma.userRoleAssignment.create({ data: { userId: owner.user.id, role: 'ADMIN' } });
    await confirm(owner, order.publicCode).expect(403);
  });

  it.each(['OPEN', 'UNDER_REVIEW'] as const)(
    'blocks HTTP confirmation during a %s dispute without changing persisted state',
    async (disputeStatus) => {
      const owner = await createActor(app, prisma, mailer);
      const { order } = await awaitingConfirmation(owner);
      await prisma.order.update({ where: { id: order.id }, data: { disputeStatus } });
      const before = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
      await confirm(owner, order.publicCode)
        .expect(409)
        .expect(({ body: response }) => expect(response.code).toBe('ACTIVE_DISPUTE'));
      expect(await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).toEqual(before);
    },
  );

  it('rejects an incorrect fulfillment state through the HTTP boundary', async () => {
    const owner = await createActor(app, prisma, mailer);
    const { order } = await awaitingConfirmation(owner);
    await prisma.order.update({
      where: { id: order.id },
      data: { fulfillmentStatus: 'AWAITING_SELLER' },
    });
    await confirm(owner, order.publicCode)
      .expect(409)
      .expect(({ body: response }) => expect(response.code).toBe('FULFILLMENT_STATE_MISMATCH'));
  });

  it('returns the persisted public order and serializes concurrent/replayed confirmations', async () => {
    const owner = await createActor(app, prisma, mailer);
    const { order } = await awaitingConfirmation(owner);
    const financialBefore = {
      transactions: await prisma.ledgerTransaction.count(),
      entries: await prisma.ledgerEntry.count(),
      events: await prisma.financialEvent.count(),
      outbox: await prisma.financialOutboxEvent.count(),
      settlements: await prisma.settlement.count(),
      holds: await prisma.financialHold.count(),
    };
    const responses = await Promise.all([
      confirm(owner, order.publicCode),
      confirm(owner, order.publicCode),
    ]);
    expect(responses.map(({ status }) => status)).toEqual([200, 200]);
    for (const response of responses) {
      expect(response.body).toMatchObject({
        orderCode: order.publicCode,
        status: 'COMPLETED',
        paymentStatus: 'PAID',
        fulfillmentStatus: 'CONFIRMED',
        disputeStatus: 'NONE',
        version: order.version + 2,
      });
      const serialized = JSON.stringify(response.body);
      for (const privateField of ['orderId', 'deliveryId', 'evidenceHash', 'secureReference'])
        expect(serialized).not.toContain(privateField);
    }
    const replay = await confirm(owner, order.publicCode).expect(200);
    expect(replay.body).toEqual(responses[0].body);
    expect(
      await prisma.orderEvent.count({
        where: { orderId: order.id, type: 'FULFILLMENT_CONFIRMED' },
      }),
    ).toBe(1);
    expect(
      await prisma.orderEvent.count({ where: { orderId: order.id, type: 'ORDER_COMPLETED' } }),
    ).toBe(1);
    expect(
      await prisma.outboxEvent.count({
        where: {
          aggregateId: order.id,
          eventType: { in: ['fulfillment.confirmed', 'order.completed'] },
        },
      }),
    ).toBe(2);
    expect(await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).toMatchObject({
      version: order.version + 2,
      status: 'COMPLETED',
      fulfillmentStatus: 'CONFIRMED',
    });
    expect({
      transactions: await prisma.ledgerTransaction.count(),
      entries: await prisma.ledgerEntry.count(),
      events: await prisma.financialEvent.count(),
      outbox: await prisma.financialOutboxEvent.count(),
      settlements: await prisma.settlement.count(),
      holds: await prisma.financialHold.count(),
    }).toEqual(financialBefore);
  });
});
