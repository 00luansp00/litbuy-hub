import cookieParser from 'cookie-parser';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { OrderStatus, PaymentStatus } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AuthMailer } from '../src/auth/auth.service';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import type { AppConfig } from '../src/config/app.config';
import { PrismaService } from '../src/database/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { authHeaders, commerceFixture, createActor } from './order-checkout-test.helpers';

type Actor = Awaited<ReturnType<typeof createActor>>;

describe('Order chat HTTP com autenticação, CSRF e PostgreSQL reais', () => {
  jest.setTimeout(120_000);
  let app: INestApplication;
  let prisma: PrismaService;
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
    mailer = app.get(AuthMailer);
    redis = app.get(RedisService);
  });

  beforeEach(async () => {
    await (await redis.getClient()).flushdb();
    mailer.sent.splice(0);
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "User", "CatalogCategory" CASCADE');
  });

  afterAll(async () => app.close());

  async function actorWithRole(role: 'BUYER' | 'SELLER') {
    const actor = await createActor(app, prisma, mailer);
    await prisma.userRoleAssignment.upsert({
      where: { userId_role: { userId: actor.user.id, role } },
      create: { userId: actor.user.id, role },
      update: {},
    });
    return actor;
  }

  async function order(
    buyer: Actor,
    seller: Actor,
    state: { status?: OrderStatus; paymentStatus?: PaymentStatus } = {},
  ) {
    const fixture = await commerceFixture(prisma);
    const profile = await prisma.sellerProfile.update({
      where: { id: fixture.seller.id },
      data: { userId: seller.user.id },
    });
    const cart = await prisma.cart.create({
      data: {
        buyerUserId: buyer.user.id,
        sellerProfileId: profile.id,
        status: 'CHECKED_OUT',
      },
    });
    return prisma.order.create({
      data: {
        publicCode: `LIT-${crypto.randomUUID().replaceAll('-', '').slice(0, 14).toUpperCase()}`,
        sourceCartId: cart.id,
        sourceCartVersion: 1,
        buyerUserId: buyer.user.id,
        sellerProfileId: profile.id,
        subtotalAmountMinor: 1000n,
        totalAmountMinor: 1000n,
        expiresAt: new Date(Date.now() + 60_000),
        status: state.status ?? 'ACTIVE',
        paymentStatus: state.paymentStatus ?? 'PAID',
      },
    });
  }

  const list = (actor?: Actor, query = '') => {
    const call = request(app.getHttpServer()).get(`/api/v1/order-chats${query}`);
    return actor ? call.set('Authorization', actor.authorization) : call;
  };
  const detail = (actor: Actor, code: string) =>
    request(app.getHttpServer())
      .get(`/api/v1/order-chats/orders/${code}`)
      .set('Authorization', actor.authorization);
  const messages = (actor: Actor, code: string, query = '') =>
    request(app.getHttpServer())
      .get(`/api/v1/order-chats/orders/${code}/messages${query}`)
      .set('Authorization', actor.authorization);
  const send = (actor: Actor, code: string, body: object, csrf = true) =>
    request(app.getHttpServer())
      .post(`/api/v1/order-chats/orders/${code}/messages`)
      .set(authHeaders(actor, csrf))
      .send(body);

  it('exige autenticação e uma das roles BUYER/SELLER', async () => {
    await list().expect(401);
    const adminOnly = await createActor(app, prisma, mailer);
    await prisma.userRoleAssignment.deleteMany({ where: { userId: adminOnly.user.id } });
    await prisma.userRoleAssignment.create({
      data: { userId: adminOnly.user.id, role: 'ADMIN' },
    });
    await list(adminOnly).expect(403);
  });

  it('lista o mesmo pedido para Buyer e Seller, pagina e não expõe campos privados', async () => {
    const buyer = await actorWithRole('BUYER');
    const seller = await actorWithRole('SELLER');
    const created = await order(buyer, seller);
    for (const actor of [buyer, seller]) {
      const response = await list(actor, '?page=1&limit=1').expect(200);
      expect(response.body).toMatchObject({
        page: 1,
        limit: 1,
        items: [
          {
            orderCode: created.publicCode,
            orderStatus: 'ACTIVE',
            paymentStatus: 'PAID',
            conversationCreated: false,
            lastMessageAt: null,
          },
        ],
      });
      expect(JSON.stringify(response.body)).not.toMatch(
        /buyerUserId|sellerProfileId|senderUserId|email|phone|address|paymentId|ledger/i,
      );
    }
    await list(buyer, '?page=0').expect(400);
    await list(buyer, '?limit=51').expect(400);
    await list(buyer, '?unknown=1').expect(400);
  });

  it('protege detalhe, histórico e envio contra IDOR e iguala pedido estrangeiro ao ausente', async () => {
    const buyer = await actorWithRole('BUYER');
    const seller = await actorWithRole('SELLER');
    const strangerBuyer = await actorWithRole('BUYER');
    const strangerSeller = await actorWithRole('SELLER');
    const created = await order(buyer, seller);
    for (const stranger of [strangerBuyer, strangerSeller]) {
      await detail(stranger, created.publicCode).expect(404);
      await messages(stranger, created.publicCode).expect(404);
      await send(stranger, created.publicCode, {
        clientMessageId: crypto.randomUUID(),
        text: 'intrusão',
      }).expect(404);
    }
    const missing = 'LIT-22222222222222';
    expect((await detail(strangerBuyer, created.publicCode)).body.code).toBe(
      'ORDER_CHAT_NOT_FOUND',
    );
    expect((await detail(buyer, missing)).body.code).toBe('ORDER_CHAT_NOT_FOUND');
  });

  it.each([
    ['PENDING_PAYMENT', 'PAID'],
    ['CANCELLED', 'PAID'],
    ['EXPIRED', 'PAID'],
    ['ACTIVE', 'NOT_CREATED'],
    ['ACTIVE', 'PENDING'],
    ['ACTIVE', 'REFUNDED'],
    ['ACTIVE', 'CHARGEBACK'],
  ] as Array<[OrderStatus, PaymentStatus]>)(
    'recusa pedido inelegível %s/%s',
    async (status, paymentStatus) => {
      const buyer = await actorWithRole('BUYER');
      const seller = await actorWithRole('SELLER');
      const created = await order(buyer, seller, { status, paymentStatus });
      await detail(buyer, created.publicCode).expect(409);
      await messages(buyer, created.publicCode).expect(409);
      await send(buyer, created.publicCode, {
        clientMessageId: crypto.randomUUID(),
        text: 'não deve entrar',
      }).expect(409);
    },
  );

  it('mantém GET sem efeitos e valida CSRF e DTO do envio', async () => {
    const buyer = await actorWithRole('BUYER');
    const seller = await actorWithRole('SELLER');
    const created = await order(buyer, seller);
    await messages(buyer, created.publicCode).expect(200, { items: [], nextCursor: null });
    expect(await prisma.orderChatConversation.count()).toBe(0);
    const valid = { clientMessageId: crypto.randomUUID(), text: 'válida' };
    await send(buyer, created.publicCode, valid, false).expect(401);
    await send(buyer, created.publicCode, valid).set('X-CSRF-Token', 'inválido').expect(401);
    await send(buyer, created.publicCode, { ...valid, text: '' }).expect(400);
    await send(buyer, created.publicCode, { ...valid, text: '   \n' }).expect(400);
    await send(buyer, created.publicCode, { ...valid, text: 'x'.repeat(4001) }).expect(400);
    await send(buyer, created.publicCode, { ...valid, extra: true }).expect(400);
  });

  it('persiste texto exato nos dois sentidos, suporta COMPLETED e aplica idempotência por sender', async () => {
    const buyer = await actorWithRole('BUYER');
    const seller = await actorWithRole('SELLER');
    const created = await order(buyer, seller, { status: 'COMPLETED' });
    const clientMessageId = crypto.randomUUID();
    const text = '  <b>texto</b> https://example.test  ';
    const first = await send(buyer, created.publicCode, { clientMessageId, text }).expect(200);
    const replay = await send(buyer, created.publicCode, { clientMessageId, text }).expect(200);
    expect(replay.body).toEqual(first.body);
    await send(buyer, created.publicCode, { clientMessageId, text: `${text}!` }).expect(409);
    const reply = await send(seller, created.publicCode, {
      clientMessageId,
      text: 'resposta',
    }).expect(200);
    expect(reply.body.author).toBe('SELF');
    expect(await prisma.orderChatConversation.count()).toBe(1);
    expect(await prisma.orderChatMessage.count()).toBe(2);
    expect(
      (await prisma.orderChatMessage.findUniqueOrThrow({ where: { id: first.body.messageId } }))
        .body,
    ).toBe(text);
    const history = await messages(buyer, created.publicCode).expect(200);
    expect(history.body.items).toHaveLength(2);
    expect(history.body.items[0]).toMatchObject({ author: 'COUNTERPARTY', text: 'resposta' });
    expect(JSON.stringify(history.body)).not.toMatch(
      /senderUserId|buyerUserId|sellerProfileId|email|phone|ledger/i,
    );
  });

  it('pagina sem duplicar e rejeita cursor pertencente a outra conversa', async () => {
    const buyer = await actorWithRole('BUYER');
    const seller = await actorWithRole('SELLER');
    const firstOrder = await order(buyer, seller);
    const secondOrder = await order(buyer, seller);
    const ids: string[] = [];
    for (const text of ['um', 'dois', 'três']) {
      const response = await send(buyer, firstOrder.publicCode, {
        clientMessageId: crypto.randomUUID(),
        text,
      }).expect(200);
      ids.push(response.body.messageId);
    }
    const page1 = await messages(buyer, firstOrder.publicCode, '?limit=2').expect(200);
    const page2 = await messages(
      buyer,
      firstOrder.publicCode,
      `?limit=2&cursor=${page1.body.nextCursor}`,
    ).expect(200);
    const pageItems = [
      ...(page1.body.items as Array<{ messageId: string }>),
      ...(page2.body.items as Array<{ messageId: string }>),
    ];
    expect(pageItems.map((item) => item.messageId).sort()).toEqual(ids.sort());
    const foreignCursor = (
      await send(buyer, secondOrder.publicCode, {
        clientMessageId: crypto.randomUUID(),
        text: 'outra conversa',
      }).expect(200)
    ).body.messageId;
    const invalid = await messages(buyer, firstOrder.publicCode, `?cursor=${foreignCursor}`).expect(
      400,
    );
    expect(invalid.body.code).toBe('ORDER_CHAT_CURSOR_INVALID');
  });

  it('serializa primeiras mensagens concorrentes e não altera domínios comerciais ou financeiros', async () => {
    const buyer = await actorWithRole('BUYER');
    const seller = await actorWithRole('SELLER');
    const created = await order(buyer, seller);
    const before = await prisma.order.findUniqueOrThrow({ where: { id: created.id } });
    const financialBefore = await Promise.all([
      prisma.orderEvent.count(),
      prisma.ledgerTransaction.count(),
      prisma.ledgerEntry.count(),
      prisma.financialEvent.count(),
      prisma.financialOutboxEvent.count(),
    ]);
    await Promise.all([
      send(buyer, created.publicCode, {
        clientMessageId: crypto.randomUUID(),
        text: 'buyer',
      }).expect(200),
      send(seller, created.publicCode, {
        clientMessageId: crypto.randomUUID(),
        text: 'seller',
      }).expect(200),
    ]);
    expect(await prisma.orderChatConversation.count({ where: { orderId: created.id } })).toBe(1);
    expect(await prisma.orderChatMessage.count()).toBe(2);
    await expect(
      prisma.orderChatConversation.create({ data: { orderId: created.id } }),
    ).rejects.toMatchObject({ code: 'P2002' });
    const after = await prisma.order.findUniqueOrThrow({ where: { id: created.id } });
    expect(after).toMatchObject({
      status: before.status,
      paymentStatus: before.paymentStatus,
      fulfillmentStatus: before.fulfillmentStatus,
      disputeStatus: before.disputeStatus,
    });
    expect(
      await Promise.all([
        prisma.orderEvent.count(),
        prisma.ledgerTransaction.count(),
        prisma.ledgerEntry.count(),
        prisma.financialEvent.count(),
        prisma.financialOutboxEvent.count(),
      ]),
    ).toEqual(financialBefore);
  });
});
