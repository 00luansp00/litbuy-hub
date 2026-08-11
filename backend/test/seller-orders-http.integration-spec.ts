import cookieParser from 'cookie-parser';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { DisputeStatus, FulfillmentStatus, OrderStatus, PaymentStatus } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AuthMailer } from '../src/auth/auth.service';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import type { AppConfig } from '../src/config/app.config';
import { PrismaService } from '../src/database/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { authHeaders, commerceFixture, createActor } from './order-checkout-test.helpers';

type Actor = Awaited<ReturnType<typeof createActor>>;
type State = Partial<{
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  disputeStatus: DisputeStatus;
}>;

const privateFields = [
  'id',
  'orderId',
  'buyerUserId',
  'sellerProfileId',
  'paymentId',
  'deliveryId',
  'ledgerId',
  'evidenceHash',
  'secureReference',
  'email',
  'phone',
  'address',
];
const expectPublic = (body: unknown) => {
  expect(body).toMatchObject({
    orderCode: expect.stringMatching(/^LIT-/),
    currency: 'BRL',
    saleAmountMinor: expect.any(String),
    status: expect.any(String),
    paymentStatus: expect.any(String),
    fulfillmentStatus: expect.any(String),
    disputeStatus: expect.any(String),
    version: expect.any(Number),
    items: [
      expect.objectContaining({
        productTitle: expect.any(String),
        quantity: expect.any(Number),
        lineTotalAmountMinor: expect.any(String),
      }),
    ],
  });
  const serialized = JSON.stringify(body);
  for (const field of privateFields) expect(serialized).not.toMatch(new RegExp(`"${field}"`, 'i'));
};

describe('Seller orders HTTP with real auth, CSRF and PostgreSQL', () => {
  jest.setTimeout(120_000);
  let app: INestApplication, prisma: PrismaService, mailer: AuthMailer, redis: RedisService;
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
    mailer = app.get(AuthMailer);
    redis = app.get(RedisService);
  });
  beforeEach(async () => {
    await (await redis.getClient()).flushdb();
    mailer.sent.splice(0);
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "User", "CatalogCategory" CASCADE');
  });
  afterAll(async () => {
    await app.close();
  });

  async function sellerActor() {
    const actor = await createActor(app, prisma, mailer);
    await prisma.userRoleAssignment.create({ data: { userId: actor.user.id, role: 'SELLER' } });
    return actor;
  }
  async function sale(owner: Actor, state: State = {}) {
    const fixture = await commerceFixture(prisma);
    await prisma.sellerProfile.update({
      where: { id: fixture.seller.id },
      data: { userId: owner.user.id },
    });
    const cart = await prisma.cart.create({
      data: {
        buyerUserId: fixture.buyer.id,
        sellerProfileId: fixture.seller.id,
        status: 'CHECKED_OUT',
      },
    });
    const code = `LIT-${crypto
      .randomUUID()
      .replace(/[-01O]/g, '2')
      .replace(/[I]/g, 'J')
      .slice(0, 14)
      .toUpperCase()}`;
    const order = await prisma.order.create({
      data: {
        publicCode: code,
        sourceCartId: cart.id,
        sourceCartVersion: 1,
        buyerUserId: fixture.buyer.id,
        sellerProfileId: fixture.seller.id,
        subtotalAmountMinor: 1000n,
        totalAmountMinor: 1000n,
        expiresAt: new Date(Date.now() + 60_000),
        status: state.status ?? 'ACTIVE',
        paymentStatus: state.paymentStatus ?? 'PAID',
        fulfillmentStatus: state.fulfillmentStatus ?? 'AWAITING_SELLER',
        disputeStatus: state.disputeStatus ?? 'NONE',
        items: {
          create: {
            sourceProductId: fixture.product.id,
            sourceProductVersion: 1,
            sellerProfileId: fixture.seller.id,
            sellerStoreName: fixture.seller.storeName,
            sellerSlug: fixture.seller.slug,
            productSlug: fixture.product.slug,
            productTitle: 'Snapshot real',
            productType: fixture.product.productType,
            productModel: fixture.product.model,
            deliveryMode: fixture.product.deliveryMode,
            unitAmountMinor: 1000n,
            quantity: 1,
            lineTotalAmountMinor: 1000n,
          },
        },
      },
    });
    if ((state.paymentStatus ?? 'PAID') === 'PAID')
      await prisma.payment.create({
        data: { orderId: order.id, amountMinor: 1000n, status: 'PAID', paidAt: new Date() },
      });
    return order;
  }
  const getList = (actor: Actor, query = '') =>
    request(app.getHttpServer())
      .get(`/api/v1/seller/orders${query}`)
      .set('Authorization', actor.authorization);
  const getDetail = (actor: Actor, code: string) =>
    request(app.getHttpServer())
      .get(`/api/v1/seller/orders/${code}`)
      .set('Authorization', actor.authorization);
  const deliver = (actor: Actor, code: string, csrf = true) =>
    request(app.getHttpServer())
      .post(`/api/v1/orders/${code}/fulfillment/delivered`)
      .set(authHeaders(actor, csrf))
      .send({});

  it('enforces authentication and SELLER role on reads', async () => {
    const buyer = await createActor(app, prisma, mailer);
    await request(app.getHttpServer()).get('/api/v1/seller/orders').expect(401);
    await getList(buyer).expect(403);
  });
  it('lists only owner sales, paginates, validates queries and emits the public model', async () => {
    const a = await sellerActor(),
      b = await sellerActor();
    const own = await sale(a);
    await sale(b);
    await sale(a);
    const first = await getList(a, '?page=1&limit=1').expect(200);
    expect(first.body).toMatchObject({ page: 1, limit: 1 });
    expect(first.body.items).toHaveLength(1);
    expectPublic(first.body.items[0]);
    const all = await getList(a, '?page=1&limit=20').expect(200);
    expect(all.body.items).toHaveLength(2);
    expect((all.body.items as Array<{ orderCode: string }>).map((x) => x.orderCode)).toContain(
      own.publicCode,
    );
    await getList(a, '?page=0').expect(400);
    await getList(a, '?limit=51').expect(400);
    await getList(a, '?status=UNKNOWN').expect(400);
  });
  it('reads owner detail and hides foreign and missing codes identically', async () => {
    const a = await sellerActor(),
      b = await sellerActor(),
      order = await sale(a);
    const response = await getDetail(a, order.publicCode).expect(200);
    expectPublic(response.body);
    await getDetail(b, order.publicCode).expect(404);
    await getDetail(a, 'LIT-23456789ABCDEF').expect(404);
    await getList(a, `?sellerId=${b.user.id}`).expect(400);
  });
  it('enforces delivery auth, SELLER role, CSRF and an empty public body', async () => {
    const owner = await sellerActor(),
      buyer = await createActor(app, prisma, mailer),
      order = await sale(owner);
    await request(app.getHttpServer())
      .post(`/api/v1/orders/${order.publicCode}/fulfillment/delivered`)
      .send({})
      .expect(401);
    await deliver(buyer, order.publicCode).expect(403);
    await deliver(owner, order.publicCode, false).expect(401);
    await deliver(owner, order.publicCode).set('X-CSRF-Token', 'invalid').expect(401);
    await request(app.getHttpServer())
      .post(`/api/v1/orders/${order.publicCode}/fulfillment/delivered`)
      .set(authHeaders(owner))
      .send({ evidenceHash: 'a'.repeat(64) })
      .expect(400);
    const response = await deliver(owner, order.publicCode).expect(200);
    expectPublic(response.body);
    expect(response.body.fulfillmentStatus).toBe('AWAITING_BUYER_CONFIRMATION');
  });
  it('is IDOR-safe and does not progress invalid order, payment, or active disputes', async () => {
    const owner = await sellerActor(),
      other = await sellerActor();
    const foreign = await sale(owner);
    await deliver(other, foreign.publicCode).expect(404);
    await deliver(owner, 'LIT-23456789ABCDEF').expect(404);
    for (const state of [
      { status: 'PENDING_PAYMENT' as const },
      { paymentStatus: 'PENDING' as const },
      { disputeStatus: 'OPEN' as const },
      { disputeStatus: 'UNDER_REVIEW' as const },
    ]) {
      const order = await sale(owner, state);
      const before = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
      await deliver(owner, order.publicCode).expect(409);
      expect(await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).toEqual(before);
    }
  });
  it('replays without duplicate delivery/events/outbox or financial movement', async () => {
    const owner = await sellerActor(),
      order = await sale(owner);
    const financialBefore = {
      transactions: await prisma.ledgerTransaction.count(),
      entries: await prisma.ledgerEntry.count(),
      events: await prisma.financialEvent.count(),
      outbox: await prisma.financialOutboxEvent.count(),
    };
    const first = await deliver(owner, order.publicCode).expect(200);
    const replay = await deliver(owner, order.publicCode).expect(200);
    expect(replay.body).toEqual(first.body);
    expect(await prisma.orderDelivery.count({ where: { orderId: order.id } })).toBe(1);
    expect(
      await prisma.orderEvent.count({
        where: {
          orderId: order.id,
          type: { in: ['FULFILLMENT_DELIVERED', 'FULFILLMENT_AWAITING_BUYER_CONFIRMATION'] },
        },
      }),
    ).toBe(2);
    expect(
      await prisma.outboxEvent.count({
        where: {
          aggregateId: order.id,
          eventType: { in: ['fulfillment.delivered', 'fulfillment.awaiting_buyer_confirmation'] },
        },
      }),
    ).toBe(2);
    expect({
      transactions: await prisma.ledgerTransaction.count(),
      entries: await prisma.ledgerEntry.count(),
      events: await prisma.financialEvent.count(),
      outbox: await prisma.financialOutboxEvent.count(),
    }).toEqual(financialBefore);
  });
});
