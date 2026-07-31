import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { CartsService } from '../src/carts/carts.service';
import { CheckoutService } from '../src/checkout/checkout.service';
import type { CheckoutResponse } from '../src/checkout/checkout.service';
import { OrdersService } from '../src/orders/orders.service';
import type { OrderReadResponse } from '../src/orders/order-read.mapper';
import { OrderExpirationService } from '../src/orders/order-expiration.service';
import { parseIdempotencyKey } from '../src/commerce/idempotency-key';
import { AppError } from '../src/common/errors/app-error';
import { commerceFixture } from './order-checkout-test.helpers';

describe('Order checkout domain with real PostgreSQL', () => {
  jest.setTimeout(120_000);
  let app: Awaited<ReturnType<ReturnType<typeof Test.createTestingModule>['compile']>>;
  let prisma: PrismaService,
    carts: CartsService,
    checkout: CheckoutService,
    orders: OrdersService,
    expiration: OrderExpirationService;
  beforeAll(async () => {
    app = await Test.createTestingModule({ imports: [AppModule] }).compile();
    prisma = app.get(PrismaService);
    carts = app.get(CartsService);
    checkout = app.get(CheckoutService);
    orders = app.get(OrdersService);
    expiration = app.get(OrderExpirationService);
  });
  beforeEach(() => prisma.$executeRawUnsafe('TRUNCATE TABLE "User", "CatalogCategory" CASCADE'));
  afterAll(async () => {
    await app.close();
  });
  const key = () => parseIdempotencyKey(`checkout:${crypto.randomUUID()}`);
  const checkoutResponse = (value: Awaited<ReturnType<CheckoutService['create']>>) =>
    value as CheckoutResponse;
  const orderResponse = (value: Awaited<ReturnType<OrdersService['cancel']>>) =>
    value as OrderReadResponse;
  async function ready(
    model: 'NORMAL' | 'DYNAMIC' | 'SERVICE' = 'NORMAL',
    pricingType?: 'FIXED' | 'QUOTE',
    stock = 5,
  ) {
    const f = await commerceFixture(prisma, model, pricingType, stock);
    const variant = model === 'DYNAMIC' ? f.product.variants[0].id : undefined;
    const preview = await carts.add(f.buyer.id, f.seller.slug, {
      productId: f.product.id,
      productVariantId: variant,
      quantity: 1,
      expectedVersion: 0,
    });
    return {
      ...f,
      preview,
      dto: {
        sellerSlug: f.seller.slug,
        expectedCartVersion: preview.version,
        expectedPreviewFingerprint: preview.previewFingerprint,
      },
    };
  }
  it.each([
    ['NORMAL', undefined],
    ['DYNAMIC', undefined],
    ['SERVICE', 'FIXED'],
  ] as const)(
    'creates authoritative %s snapshots and only applicable reservations',
    async (model, pricingType) => {
      const f = await ready(model, pricingType);
      const before = await prisma.product.findUniqueOrThrow({
        where: { id: f.product.id },
        include: { variants: true },
      });
      const response = checkoutResponse(await checkout.create(f.buyer.id, key(), f.dto));
      expect(response).toMatchObject({
        status: 'PENDING_PAYMENT',
        paymentStatus: 'NOT_CREATED',
        totalAmountMinor: expect.any(String),
        items: [{ productTitle: 'Original title', unitAmountMinor: expect.any(String) }],
      });
      const order = await prisma.order.findUniqueOrThrow({
        where: { publicCode: response.orderCode },
        include: { items: true, reservations: true, events: { include: { outbox: true } } },
      });
      expect(order.items).toHaveLength(1);
      expect(order.reservations).toHaveLength(model === 'SERVICE' ? 0 : 1);
      if (model === 'DYNAMIC')
        expect(order.reservations[0].productVariantId).toBe(f.product.variants[0].id);
      expect(order.events.every((event) => event.outbox?.status === 'PENDING')).toBe(true);
      expect(
        await prisma.securityEvent.count({ where: { eventType: 'CHECKOUT_ORDER_CREATED' } }),
      ).toBe(1);
      expect(
        await prisma.cart.findUniqueOrThrow({ where: { id: order.sourceCartId } }),
      ).toMatchObject({ status: 'CHECKED_OUT', version: 2 });
      const after = await prisma.product.findUniqueOrThrow({
        where: { id: f.product.id },
        include: { variants: true },
      });
      expect(after.stock).toBe(before.stock);
      expect(after.variants.map((v) => v.stock)).toEqual(before.variants.map((v) => v.stock));
    },
  );
  it('rejects QUOTE atomically', async () => {
    const f = await commerceFixture(prisma, 'SERVICE', 'QUOTE');
    const cart = await prisma.cart.create({
      data: {
        buyerUserId: f.buyer.id,
        sellerProfileId: f.seller.id,
        items: { create: { productId: f.product.id, quantity: 1 } },
      },
    });
    await expect(
      checkout.create(f.buyer.id, key(), {
        sellerSlug: f.seller.slug,
        expectedCartVersion: 1,
        expectedPreviewFingerprint: 'sha256:'.padEnd(71, '0'),
      }),
    ).rejects.toBeInstanceOf(AppError);
    expect(await prisma.order.count()).toBe(0);
    expect(await prisma.inventoryReservation.count()).toBe(0);
    expect(await prisma.orderEvent.count()).toBe(0);
    expect(await prisma.cart.findUniqueOrThrow({ where: { id: cart.id } })).toMatchObject({
      status: 'ACTIVE',
      version: 1,
    });
  });
  it('rejects self-purchase and products that become unavailable without partial writes', async () => {
    const unavailable = await ready();
    await prisma.product.update({
      where: { id: unavailable.product.id },
      data: { status: 'PAUSED' },
    });
    await expect(
      checkout.create(unavailable.buyer.id, key(), unavailable.dto),
    ).rejects.toMatchObject({ code: 'PRODUCT_NOT_PURCHASABLE' });
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "User", "CatalogCategory" CASCADE');
    const own = await commerceFixture(prisma);
    await prisma.userRoleAssignment.create({ data: { userId: own.sellerUser.id, role: 'BUYER' } });
    await prisma.cart.create({
      data: {
        buyerUserId: own.sellerUser.id,
        sellerProfileId: own.seller.id,
        items: { create: { productId: own.product.id, quantity: 1 } },
      },
    });
    const preview = await carts.get(own.sellerUser.id, own.seller.slug);
    await expect(
      checkout.create(own.sellerUser.id, key(), {
        sellerSlug: own.seller.slug,
        expectedCartVersion: preview.version,
        expectedPreviewFingerprint: preview.previewFingerprint,
      }),
    ).rejects.toMatchObject({ code: 'SELF_PURCHASE_NOT_ALLOWED' });
    expect(await prisma.order.count()).toBe(0);
  });
  it.each(['NORMAL', 'DYNAMIC'] as const)(
    'prevents %s overselling under concurrent checkouts',
    async (model) => {
      const first = await ready(model, undefined, 1);
      const secondBuyer = await prisma.user.create({
        data: {
          email: `second-${crypto.randomUUID()}@test.local`,
          birthDate: new Date('2000-01-01'),
          status: 'ACTIVE',
          termsVersion: 't',
          termsAcceptedAt: new Date(),
          privacyVersion: 'p',
          privacyAcceptedAt: new Date(),
          roleAssignments: { create: { role: 'BUYER' } },
        },
      });
      const preview = await carts.add(secondBuyer.id, first.seller.slug, {
        productId: first.product.id,
        productVariantId: model === 'DYNAMIC' ? first.product.variants[0].id : undefined,
        quantity: 1,
        expectedVersion: 0,
      });
      const results = await Promise.allSettled([
        checkout.create(first.buyer.id, key(), first.dto),
        checkout.create(secondBuyer.id, key(), {
          sellerSlug: first.seller.slug,
          expectedCartVersion: preview.version,
          expectedPreviewFingerprint: preview.previewFingerprint,
        }),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(
        results.filter(
          (r) =>
            r.status === 'rejected' &&
            r.reason instanceof AppError &&
            r.reason.code === 'INSUFFICIENT_STOCK',
        ),
      ).toHaveLength(1);
      expect(await prisma.order.count()).toBe(1);
      expect(await prisma.inventoryReservation.count({ where: { status: 'ACTIVE' } })).toBe(1);
      expect(
        (
          await prisma.product.findUniqueOrThrow({
            where: { id: first.product.id },
            include: { variants: true },
          })
        ).variants[0].stock,
      ).toBe(1);
    },
  );
  it('serializes same-cart and same-key concurrency without duplicate commerce effects', async () => {
    const f = await ready();
    const sameCart = await Promise.allSettled([
      checkout.create(f.buyer.id, key(), f.dto),
      checkout.create(f.buyer.id, key(), f.dto),
    ]);
    expect(sameCart.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await prisma.order.count()).toBe(1);
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "User", "CatalogCategory" CASCADE');
    const i = await ready();
    const shared = key();
    const replay = await Promise.all([
      checkout.create(i.buyer.id, shared, i.dto),
      checkout.create(i.buyer.id, shared, i.dto),
    ]);
    expect(replay[0]).toEqual(replay[1]);
    expect(await prisma.order.count()).toBe(1);
    expect(await prisma.commerceIdempotencyRecord.count()).toBe(1);
    await expect(
      checkout.create(i.buyer.id, shared, { ...i.dto, expectedCartVersion: 99 }),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED' });
  });
  it('reads immutable snapshots after mutable catalog changes', async () => {
    const f = await ready();
    const created = checkoutResponse(await checkout.create(f.buyer.id, key(), f.dto));
    const originalSellerSlug = f.seller.slug;
    const originalProductSlug = f.product.slug;
    await prisma.product.update({
      where: { id: f.product.id },
      data: {
        title: 'Changed',
        slug: `changed-${crypto.randomUUID()}`,
        price: 99,
        status: 'PAUSED',
      },
    });
    await prisma.sellerProfile.update({
      where: { id: f.seller.id },
      data: { storeName: 'Changed Store', slug: `changed-store-${crypto.randomUUID()}` },
    });
    const detail = await orders.get(f.buyer.id, created.orderCode);
    expect(detail).toMatchObject({
      seller: { slug: originalSellerSlug, storeName: 'Snapshot Store' },
      items: [
        {
          productTitle: 'Original title',
          productSlug: originalProductSlug,
          unitAmountMinor: '1000',
          lineTotalAmountMinor: '1000',
        },
      ],
    });
    const list = await orders.list(f.buyer.id, { page: 1, limit: 20 });
    expect(list.items[0]).toMatchObject(detail);
    const cancellationKey = key();
    const cancelled = orderResponse(
      await orders.cancel(f.buyer.id, created.orderCode, cancellationKey, { expectedVersion: 1 }),
    );
    expect(cancelled).toMatchObject({
      seller: { slug: originalSellerSlug, storeName: 'Snapshot Store' },
      items: [{ productTitle: 'Original title', productSlug: originalProductSlug }],
    });
    const replay = orderResponse(
      await orders.cancel(f.buyer.id, created.orderCode, cancellationKey, { expectedVersion: 1 }),
    );
    expect(replay).toEqual(cancelled);
    const serialized = JSON.stringify(detail);
    for (const field of [
      'objectKey',
      'accountDetails',
      'csrfTokenHash',
      'reservation',
      'outbox',
      'securityEvent',
      'keyHash',
    ])
      expect(serialized).not.toContain(field);
  });
  it('fails closed for missing or inconsistent seller snapshots', async () => {
    const missing = await ready('SERVICE', 'FIXED');
    const missingOrder = checkoutResponse(
      await checkout.create(missing.buyer.id, key(), missing.dto),
    );
    const persistedMissing = await prisma.order.findUniqueOrThrow({
      where: { publicCode: missingOrder.orderCode },
      include: { items: true },
    });
    await prisma.orderItem.delete({ where: { id: persistedMissing.items[0].id } });
    await expect(orders.get(missing.buyer.id, missingOrder.orderCode)).rejects.toMatchObject({
      code: 'ORDER_SNAPSHOT_INVALID',
      statusCode: 500,
      details: [],
    });

    await prisma.$executeRawUnsafe('TRUNCATE TABLE "User", "CatalogCategory" CASCADE');
    const inconsistent = await ready('SERVICE', 'FIXED');
    const inconsistentOrder = checkoutResponse(
      await checkout.create(inconsistent.buyer.id, key(), inconsistent.dto),
    );
    const persistedInconsistent = await prisma.order.findUniqueOrThrow({
      where: { publicCode: inconsistentOrder.orderCode },
      include: { items: true },
    });
    const original = persistedInconsistent.items[0];
    await prisma.orderItem.create({
      data: {
        orderId: persistedInconsistent.id,
        sourceProductId: original.sourceProductId,
        sourceProductVersion: original.sourceProductVersion,
        sellerProfileId: original.sellerProfileId,
        sellerStoreName: 'Corrupted Store',
        sellerSlug: original.sellerSlug,
        productSlug: original.productSlug,
        productTitle: original.productTitle,
        productType: original.productType,
        productModel: original.productModel,
        deliveryMode: original.deliveryMode,
        unitAmountMinor: original.unitAmountMinor,
        quantity: original.quantity,
        lineTotalAmountMinor: original.lineTotalAmountMinor,
        currency: original.currency,
        pricingPolicyVersion: original.pricingPolicyVersion,
      },
    });
    await expect(
      orders.get(inconsistent.buyer.id, inconsistentOrder.orderCode),
    ).rejects.toMatchObject({ code: 'ORDER_SNAPSHOT_INVALID', statusCode: 500, details: [] });
  });
  it('cancels and expires idempotently while releasing reservations and preserving carts and stock', async () => {
    const f = await ready();
    const created = checkoutResponse(await checkout.create(f.buyer.id, key(), f.dto));
    const cancellationKey = key();
    const cancelled = orderResponse(
      await orders.cancel(f.buyer.id, created.orderCode, cancellationKey, {
        expectedVersion: 1,
      }),
    );
    expect(cancelled.version).toBe(2);
    expect(await prisma.inventoryReservation.count({ where: { status: 'RELEASED' } })).toBe(1);
    await orders.cancel(f.buyer.id, created.orderCode, cancellationKey, { expectedVersion: 1 });
    await orders.cancel(f.buyer.id, created.orderCode, key(), { expectedVersion: 1 });
    expect(await prisma.orderEvent.count({ where: { type: 'ORDER_CANCELLED' } })).toBe(1);
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "User", "CatalogCategory" CASCADE');
    const e = await ready();
    const expiring = checkoutResponse(await checkout.create(e.buyer.id, key(), e.dto));
    await prisma.order.update({
      where: { publicCode: expiring.orderCode },
      data: { expiresAt: new Date(0) },
    });
    expect((await expiration.expire()).expired).toBe(1);
    expect((await expiration.expire()).expired).toBe(0);
    const expired = await prisma.order.findUniqueOrThrow({
      where: { publicCode: expiring.orderCode },
      include: { sourceCart: true, events: { include: { outbox: true } }, reservations: true },
    });
    expect(expired).toMatchObject({
      status: 'EXPIRED',
      version: 2,
      sourceCart: { status: 'CHECKED_OUT' },
      reservations: [{ status: 'EXPIRED' }],
    });
    expect(expired.events.map((event) => event.type)).toEqual(
      expect.arrayContaining(['ORDER_EXPIRED', 'INVENTORY_RELEASED']),
    );
    expect(expired.events.every((event) => event.outbox)).toBe(true);
  });
  it('rolls back checkout when a downstream append-only write fails', async () => {
    for (const table of [
      'OrderItem',
      'InventoryReservation',
      'OrderEvent',
      'OutboxEvent',
      'SecurityEvent',
      'CommerceIdempotencyRecord',
    ]) {
      await prisma.$executeRawUnsafe('TRUNCATE TABLE "User", "CatalogCategory" CASCADE');
      const f = await ready();
      const fn = `reject_${table.toLowerCase()}`;
      await prisma.$executeRawUnsafe(
        `CREATE FUNCTION "${fn}"() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'forced'; END; $$ LANGUAGE plpgsql`,
      );
      await prisma.$executeRawUnsafe(
        `CREATE TRIGGER "${fn}" BEFORE INSERT ON "${table}" FOR EACH ROW EXECUTE FUNCTION "${fn}"()`,
      );
      await expect(checkout.create(f.buyer.id, key(), f.dto)).rejects.toBeDefined();
      expect(await prisma.order.count()).toBe(0);
      expect(await prisma.orderItem.count()).toBe(0);
      expect(await prisma.inventoryReservation.count()).toBe(0);
      expect(await prisma.orderEvent.count()).toBe(0);
      expect(await prisma.outboxEvent.count()).toBe(0);
      expect(await prisma.commerceIdempotencyRecord.count()).toBe(0);
      expect(await prisma.cart.findFirstOrThrow()).toMatchObject({ status: 'ACTIVE', version: 1 });
      await prisma.$executeRawUnsafe(`DROP TRIGGER "${fn}" ON "${table}"`);
      await prisma.$executeRawUnsafe(`DROP FUNCTION "${fn}"()`);
    }
  });
  it('rolls back cancellation and expiration when their outbox append fails', async () => {
    const cancellation = await ready();
    const created = checkoutResponse(
      await checkout.create(cancellation.buyer.id, key(), cancellation.dto),
    );
    await prisma.$executeRawUnsafe(
      `CREATE FUNCTION "reject_lifecycle_outbox"() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'forced'; END; $$ LANGUAGE plpgsql`,
    );
    await prisma.$executeRawUnsafe(
      `CREATE TRIGGER "reject_lifecycle_outbox" BEFORE INSERT ON "OutboxEvent" FOR EACH ROW EXECUTE FUNCTION "reject_lifecycle_outbox"()`,
    );
    await expect(
      orders.cancel(cancellation.buyer.id, created.orderCode, key(), { expectedVersion: 1 }),
    ).rejects.toBeDefined();
    expect(
      await prisma.order.findUniqueOrThrow({ where: { publicCode: created.orderCode } }),
    ).toMatchObject({ status: 'PENDING_PAYMENT', version: 1 });
    expect(await prisma.inventoryReservation.findFirstOrThrow()).toMatchObject({
      status: 'ACTIVE',
    });
    await prisma.$executeRawUnsafe(`DROP TRIGGER "reject_lifecycle_outbox" ON "OutboxEvent"`);
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "User", "CatalogCategory" CASCADE');
    const expiry = await ready();
    const expiring = checkoutResponse(await checkout.create(expiry.buyer.id, key(), expiry.dto));
    await prisma.order.update({
      where: { publicCode: expiring.orderCode },
      data: { expiresAt: new Date(0) },
    });
    await prisma.$executeRawUnsafe(
      `CREATE TRIGGER "reject_lifecycle_outbox" BEFORE INSERT ON "OutboxEvent" FOR EACH ROW EXECUTE FUNCTION "reject_lifecycle_outbox"()`,
    );
    await expect(expiration.expire()).rejects.toBeDefined();
    expect(
      await prisma.order.findUniqueOrThrow({ where: { publicCode: expiring.orderCode } }),
    ).toMatchObject({ status: 'PENDING_PAYMENT', version: 1 });
    expect(await prisma.inventoryReservation.findFirstOrThrow()).toMatchObject({
      status: 'ACTIVE',
    });
    await prisma.$executeRawUnsafe(`DROP TRIGGER "reject_lifecycle_outbox" ON "OutboxEvent"`);
    await prisma.$executeRawUnsafe(`DROP FUNCTION "reject_lifecycle_outbox"()`);
  });
  it('executes all six advisory-lock paths without void deserialization or P2010', async () => {
    const normal = await ready('NORMAL');
    const checkoutKey = key();
    const created = checkoutResponse(
      await checkout.create(normal.buyer.id, checkoutKey, normal.dto),
    );
    const replay = await checkout.create(normal.buyer.id, checkoutKey, normal.dto);
    expect(replay).toEqual(created);
    await expect(
      orders.cancel(normal.buyer.id, created.orderCode, key(), { expectedVersion: 1 }),
    ).resolves.toMatchObject({ status: 'CANCELLED' });

    await prisma.$executeRawUnsafe('TRUNCATE TABLE "User", "CatalogCategory" CASCADE');
    const dynamic = await ready('DYNAMIC');
    const dynamicOrder = checkoutResponse(
      await checkout.create(dynamic.buyer.id, key(), dynamic.dto),
    );
    await prisma.order.update({
      where: { publicCode: dynamicOrder.orderCode },
      data: { expiresAt: new Date(0) },
    });
    await expect(expiration.expire()).resolves.toMatchObject({ expired: 1 });
  });
  it('executes monetary, quantity, currency and uniqueness constraints in PostgreSQL', async () => {
    const f = await ready();
    const created = checkoutResponse(await checkout.create(f.buyer.id, key(), f.dto));
    const order = await prisma.order.findUniqueOrThrow({
      where: { publicCode: created.orderCode },
      include: { items: true, reservations: true, events: true },
    });
    for (const sql of [
      `UPDATE "Order" SET "version"=0 WHERE id='${order.id}'`,
      `UPDATE "Order" SET "subtotalAmountMinor"=-1 WHERE id='${order.id}'`,
      `UPDATE "Order" SET "discountAmountMinor"=999999 WHERE id='${order.id}'`,
      `UPDATE "Order" SET "totalAmountMinor"=1 WHERE id='${order.id}'`,
      `UPDATE "Order" SET currency='USD' WHERE id='${order.id}'`,
      `UPDATE "OrderItem" SET quantity=0 WHERE id='${order.items[0].id}'`,
      `UPDATE "InventoryReservation" SET quantity=0 WHERE id='${order.reservations[0].id}'`,
    ])
      await expect(prisma.$executeRawUnsafe(sql)).rejects.toBeDefined();
    await expect(
      prisma.outboxEvent.create({
        data: {
          orderEventId: order.events[0].id,
          aggregateType: 'ORDER',
          aggregateId: order.id,
          eventType: 'duplicate',
          payload: {},
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
    const idem = await prisma.commerceIdempotencyRecord.findFirstOrThrow();
    await expect(
      prisma.commerceIdempotencyRecord.create({
        data: {
          actorUserId: idem.actorUserId,
          operation: idem.operation,
          keyHash: idem.keyHash,
          requestHash: idem.requestHash,
          expiresAt: new Date(),
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });
});
