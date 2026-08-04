import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { CartsService } from '../src/carts/carts.service';
import { CheckoutService } from '../src/checkout/checkout.service';
import { PaidOrderActivationService } from '../src/orders/paid-order-activation.service';
import { OrderExpirationService } from '../src/orders/order-expiration.service';
import { parseIdempotencyKey } from '../src/commerce/idempotency-key';
import { commerceFixture } from './order-checkout-test.helpers';
import { acquireAdvisoryTransactionLock } from '../src/database/advisory-lock';

describe('Paid order activation with real PostgreSQL', () => {
  jest.setTimeout(120_000);
  let app: Awaited<ReturnType<ReturnType<typeof Test.createTestingModule>['compile']>>;
  let prisma: PrismaService;
  let carts: CartsService;
  let checkout: CheckoutService;
  let activation: PaidOrderActivationService;
  let expiration: OrderExpirationService;

  beforeAll(async () => {
    app = await Test.createTestingModule({ imports: [AppModule] }).compile();
    prisma = app.get(PrismaService);
    carts = app.get(CartsService);
    checkout = app.get(CheckoutService);
    activation = app.get(PaidOrderActivationService);
    expiration = app.get(OrderExpirationService);
  });
  beforeEach(() => prisma.$executeRawUnsafe('TRUNCATE TABLE "User", "CatalogCategory" CASCADE'));
  afterAll(() => app.close());

  async function paidOrder(model: 'NORMAL' | 'DYNAMIC' | 'SERVICE' = 'NORMAL', stock = 5) {
    const fixture = await commerceFixture(
      prisma,
      model,
      model === 'SERVICE' ? 'FIXED' : undefined,
      stock,
    );
    const variantId = model === 'DYNAMIC' ? fixture.product.variants[0].id : undefined;
    const preview = await carts.add(fixture.buyer.id, fixture.seller.slug, {
      productId: fixture.product.id,
      productVariantId: variantId,
      quantity: 1,
      expectedVersion: 0,
    });
    const response = (await checkout.create(
      fixture.buyer.id,
      parseIdempotencyKey(`activation:${crypto.randomUUID()}`),
      {
        sellerSlug: fixture.seller.slug,
        expectedCartVersion: preview.version,
        expectedPreviewFingerprint: preview.previewFingerprint,
      },
    )) as { orderCode: string };
    const checkoutOrder = await prisma.order.findUniqueOrThrow({
      where: { publicCode: response.orderCode },
    });
    const order = await prisma.order.update({
      where: { id: checkoutOrder.id },
      data: { paymentStatus: 'PENDING', version: { increment: 1 } },
    });
    const paidAt = new Date(order.expiresAt.getTime() - 1_000);
    const payment = await prisma.payment.create({
      data: { orderId: order.id, amountMinor: order.totalAmountMinor, status: 'PAID', paidAt },
    });
    await prisma.paymentAttempt.create({
      data: {
        paymentId: payment.id,
        attemptNumber: 1,
        providerCode: 'test',
        status: 'SUCCEEDED',
        amountMinor: payment.amountMinor,
        externalPaymentId: crypto.randomUUID(),
        idempotencyKeyHash: crypto.randomUUID(),
        requestHash: crypto.randomUUID(),
      },
    });
    return {
      fixture,
      order,
      payment,
      checkoutOrderVersion: checkoutOrder.version,
      selectedVariantId: variantId,
      otherVariantId:
        model === 'DYNAMIC'
          ? fixture.product.variants.find((variant) => variant.id !== variantId)!.id
          : undefined,
    };
  }

  async function issueFor(orderId: string) {
    return prisma.reconciliationIssue.findFirstOrThrow({
      where: { referenceType: 'OrderActivation', referenceId: orderId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async function expectUnchanged(orderId: string, productId: string, stock: number) {
    expect(await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).toMatchObject({
      status: 'PENDING_PAYMENT',
    });
    expect(await prisma.product.findUniqueOrThrow({ where: { id: productId } })).toMatchObject({
      stock,
    });
    expect(
      await prisma.orderEvent.count({
        where: { orderId, type: { in: ['ORDER_ACTIVATED', 'INVENTORY_CONSUMED'] } },
      }),
    ).toBe(0);
    expect(
      await prisma.outboxEvent.count({
        where: {
          aggregateId: orderId,
          eventType: { in: ['ORDER_ACTIVATED', 'INVENTORY_CONSUMED'] },
        },
      }),
    ).toBe(0);
  }

  it.each(['NORMAL', 'DYNAMIC', 'SERVICE'] as const)(
    'activates %s from persisted payment truth and applies only its stock rules',
    async (model) => {
      const { fixture, order, selectedVariantId, checkoutOrderVersion } = await paidOrder(model);
      expect(order).toMatchObject({
        status: 'PENDING_PAYMENT',
        paymentStatus: 'PENDING',
        version: checkoutOrderVersion + 1,
      });
      const accountingBefore = await Promise.all([
        prisma.ledgerTransaction.count(),
        prisma.ledgerEntry.count(),
        prisma.settlement.count(),
        prisma.financialHold.count(),
        prisma.financialEvent.count(),
      ]);
      expect(await activation.processOne(order.id)).toBe(true);
      const updated = await prisma.order.findUniqueOrThrow({
        where: { id: order.id },
        include: { reservations: true, events: { include: { outbox: true } } },
      });
      expect(updated).toMatchObject({
        status: 'ACTIVE',
        paymentStatus: 'PAID',
        fulfillmentStatus: 'NOT_AVAILABLE',
        version: order.version + 1,
      });
      expect(updated.reservations).toHaveLength(model === 'SERVICE' ? 0 : 1);
      if (model !== 'SERVICE') {
        expect(updated.reservations[0]).toMatchObject({
          status: 'CONSUMED',
          releasedAt: null,
          releaseReason: null,
        });
        expect(updated.reservations[0].consumedAt).toBeInstanceOf(Date);
      }
      const stock =
        model === 'DYNAMIC'
          ? (
              await prisma.productVariant.findUniqueOrThrow({
                where: { id: selectedVariantId! },
              })
            ).stock
          : (await prisma.product.findUniqueOrThrow({ where: { id: fixture.product.id } })).stock;
      expect(stock).toBe(model === 'SERVICE' ? null : 4);
      expect(updated.events.filter(({ type }) => type === 'ORDER_ACTIVATED')).toHaveLength(1);
      expect(updated.events.filter(({ type }) => type === 'INVENTORY_CONSUMED')).toHaveLength(
        model === 'SERVICE' ? 0 : 1,
      );
      const activationEvents = updated.events.filter(({ type }) =>
        ['ORDER_ACTIVATED', 'INVENTORY_CONSUMED'].includes(type),
      );
      expect(activationEvents).toHaveLength(model === 'SERVICE' ? 1 : 2);
      expect(
        activationEvents.every(
          ({ type, outbox }) => outbox?.status === 'PENDING' && outbox.eventType === type,
        ),
      ).toBe(true);
      expect(
        await Promise.all([
          prisma.ledgerTransaction.count(),
          prisma.ledgerEntry.count(),
          prisma.settlement.count(),
          prisma.financialHold.count(),
          prisma.financialEvent.count(),
        ]),
      ).toEqual(accountingBefore);
    },
  );

  it('is idempotent under replay and concurrent workers, including paused listings', async () => {
    const { fixture, order } = await paidOrder('NORMAL', 2);
    await prisma.product.update({ where: { id: fixture.product.id }, data: { status: 'PAUSED' } });
    await Promise.all([activation.processOne(order.id), activation.processOne(order.id)]);
    const afterFirst = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    const outboxAfterFirst = await prisma.outboxEvent.count({
      where: {
        aggregateId: order.id,
        eventType: { in: ['ORDER_ACTIVATED', 'INVENTORY_CONSUMED'] },
      },
    });
    expect(await activation.processOne(order.id)).toBe(true);
    expect(
      await prisma.product.findUniqueOrThrow({ where: { id: fixture.product.id } }),
    ).toMatchObject({ stock: 1 });
    expect(
      await prisma.orderEvent.count({ where: { orderId: order.id, type: 'ORDER_ACTIVATED' } }),
    ).toBe(1);
    expect(
      await prisma.orderEvent.count({ where: { orderId: order.id, type: 'INVENTORY_CONSUMED' } }),
    ).toBe(1);
    expect(await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).toMatchObject({
      version: afterFirst.version,
    });
    expect(
      await prisma.outboxEvent.count({
        where: {
          aggregateId: order.id,
          eventType: { in: ['ORDER_ACTIVATED', 'INVENTORY_CONSUMED'] },
        },
      }),
    ).toBe(outboxAfterFirst);
    expect(await activation.processOne()).toBe(false);
  });

  it('fails closed and reconciles late payment without partial effects', async () => {
    const { fixture, order, payment } = await paidOrder('NORMAL', 1);
    await prisma.payment.update({
      where: { id: payment.id },
      data: { paidAt: new Date(order.expiresAt.getTime() + 1) },
    });
    await activation.processOne(order.id);
    expect(await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).toMatchObject({
      status: 'PENDING_PAYMENT',
    });
    expect(
      await prisma.product.findUniqueOrThrow({ where: { id: fixture.product.id } }),
    ).toMatchObject({ stock: 1 });
    expect(
      await prisma.inventoryReservation.findFirstOrThrow({ where: { orderId: order.id } }),
    ).toMatchObject({ status: 'ACTIVE' });
    expect(
      await prisma.reconciliationIssue.findFirstOrThrow({
        where: { referenceType: 'OrderActivation', referenceId: order.id },
      }),
    ).toMatchObject({ type: 'LATE_PAYMENT', status: 'OPEN' });
  });

  it('never expires an authoritatively paid order and activation can run after its TTL', async () => {
    const { order, payment } = await paidOrder('NORMAL', 1);
    const expiresAt = new Date(Date.now() - 1_000);
    await prisma.payment.update({
      where: { id: payment.id },
      data: { paidAt: new Date(expiresAt.getTime() - 1_000) },
    });
    await prisma.order.update({ where: { id: order.id }, data: { expiresAt } });
    await prisma.inventoryReservation.updateMany({
      where: { orderId: order.id },
      data: { expiresAt: new Date(Date.now() + 10_000) },
    });
    await Promise.all([expiration.expire(), activation.processOne(order.id)]);
    expect(await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).toMatchObject({
      status: 'ACTIVE',
    });
    expect(
      await prisma.inventoryReservation.findFirstOrThrow({ where: { orderId: order.id } }),
    ).toMatchObject({ status: 'CONSUMED' });
  });

  it('skips an open activation issue and retries after it is resolved', async () => {
    const { order, payment } = await paidOrder('SERVICE');
    await prisma.paymentAttempt.deleteMany({ where: { paymentId: payment.id } });
    await activation.processOne(order.id);
    const issue = await issueFor(order.id);
    expect(await activation.processOne()).toBe(false);
    await prisma.reconciliationIssue.update({
      where: { id: issue.id },
      data: { status: 'INVESTIGATING' },
    });
    expect(await activation.processOne()).toBe(false);
    expect(
      await prisma.reconciliationIssue.count({
        where: {
          referenceType: 'OrderActivation',
          referenceId: order.id,
          status: { in: ['OPEN', 'INVESTIGATING'] },
        },
      }),
    ).toBe(1);
    await prisma.reconciliationIssue.update({
      where: { id: issue.id },
      data: { status: 'RESOLVED', resolvedAt: new Date() },
    });
    expect(await activation.processOne()).toBe(true);
    expect(await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).toMatchObject({
      status: 'PENDING_PAYMENT',
    });
    const repeated = await issueFor(order.id);
    await prisma.paymentAttempt.create({
      data: {
        paymentId: payment.id,
        attemptNumber: 2,
        providerCode: 'test',
        status: 'SUCCEEDED',
        amountMinor: payment.amountMinor,
        externalPaymentId: crypto.randomUUID(),
        idempotencyKeyHash: crypto.randomUUID(),
        requestHash: crypto.randomUUID(),
      },
    });
    await prisma.reconciliationIssue.update({
      where: { id: repeated.id },
      data: { status: 'RESOLVED', resolvedAt: new Date() },
    });
    expect(await activation.processOne()).toBe(true);
    expect(await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).toMatchObject({
      status: 'ACTIVE',
    });
  });

  it.each([
    [
      'payment not paid',
      async ({ payment }: Awaited<ReturnType<typeof paidOrder>>) =>
        prisma.payment.update({ where: { id: payment.id }, data: { status: 'PENDING' } }),
      'PAYMENT_NOT_PAID',
    ],
    [
      'paidAt missing',
      async ({ payment }: Awaited<ReturnType<typeof paidOrder>>) =>
        prisma.payment.update({ where: { id: payment.id }, data: { paidAt: null } }),
      'PAYMENT_PAID_AT_MISSING',
    ],
    [
      'payment amount mismatch',
      async ({ payment }: Awaited<ReturnType<typeof paidOrder>>) =>
        prisma.payment.update({
          where: { id: payment.id },
          data: { amountMinor: { increment: 1 } },
        }),
      'PAYMENT_AMOUNT_MISMATCH',
    ],
    [
      'order payment projection mismatch',
      async ({ order }: Awaited<ReturnType<typeof paidOrder>>) =>
        prisma.order.update({ where: { id: order.id }, data: { paymentStatus: 'FAILED' } }),
      'ORDER_PAYMENT_STATUS_MISMATCH',
    ],
  ] as const)('fails closed for %s', async (_name, corrupt, errorCode) => {
    const context = await paidOrder('NORMAL', 2);
    await corrupt(context);
    await activation.processOne(context.order.id);
    await expectUnchanged(context.order.id, context.fixture.product.id, 2);
    expect((await issueFor(context.order.id)).details).toMatchObject({ errorCode });
  });

  it('enforces BRL currency on Payment at the PostgreSQL boundary', async () => {
    const { payment } = await paidOrder('SERVICE');
    await expect(
      prisma.payment.update({ where: { id: payment.id }, data: { currency: 'USD' } }),
    ).rejects.toThrow();
    expect(await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).toMatchObject({
      currency: 'BRL',
    });
  });

  it('enforces BRL currency on Order at the PostgreSQL boundary', async () => {
    const { order } = await paidOrder('SERVICE');
    await expect(
      prisma.order.update({ where: { id: order.id }, data: { currency: 'USD' } }),
    ).rejects.toThrow();
    expect(await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).toMatchObject({
      currency: 'BRL',
    });
  });

  it('reconciles a missing succeeded attempt', async () => {
    const missing = await paidOrder('SERVICE');
    await prisma.paymentAttempt.deleteMany({ where: { paymentId: missing.payment.id } });
    await activation.processOne(missing.order.id);
    expect((await issueFor(missing.order.id)).details).toMatchObject({
      errorCode: 'SUCCEEDED_ATTEMPT_MISSING',
    });
  });

  it('reconciles multiple succeeded attempts', async () => {
    const multiple = await paidOrder('SERVICE');
    await prisma.paymentAttempt.create({
      data: {
        paymentId: multiple.payment.id,
        attemptNumber: 2,
        providerCode: 'other-test',
        status: 'SUCCEEDED',
        amountMinor: multiple.payment.amountMinor,
        externalPaymentId: crypto.randomUUID(),
        idempotencyKeyHash: crypto.randomUUID(),
        requestHash: crypto.randomUUID(),
      },
    });
    await activation.processOne(multiple.order.id);
    expect((await issueFor(multiple.order.id)).details).toMatchObject({
      errorCode: 'MULTIPLE_SUCCEEDED_ATTEMPTS',
    });
  });

  it.each([
    ['amount', { amountMinor: { increment: 1 } }],
    ['currency', { currency: 'USD' }],
    ['external identity', { externalPaymentId: null }],
    ['provider identity', { providerCode: '' }],
  ] as const)('reconciles a succeeded attempt with incompatible %s', async (_name, data) => {
    const malformed = await paidOrder('SERVICE');
    await prisma.paymentAttempt.updateMany({
      where: { paymentId: malformed.payment.id },
      data,
    });
    await activation.processOne(malformed.order.id);
    expect((await issueFor(malformed.order.id)).details).toMatchObject({
      errorCode: 'SUCCEEDED_ATTEMPT_MISMATCH',
    });
  });

  it('reconciles a succeeded attempt correlated to another payment', async () => {
    const original = await paidOrder('SERVICE');
    const other = await paidOrder('SERVICE');
    await prisma.paymentAttempt.deleteMany({ where: { paymentId: other.payment.id } });
    await prisma.paymentAttempt.updateMany({
      where: { paymentId: original.payment.id },
      data: { paymentId: other.payment.id, attemptNumber: 2 },
    });
    await activation.processOne(original.order.id);
    expect((await issueFor(original.order.id)).details).toMatchObject({
      errorCode: 'SUCCEEDED_ATTEMPT_MISSING',
    });
  });

  it('uses paidAt, not worker wall clock, for expired order and reservation TTLs', async () => {
    const { order, payment } = await paidOrder('NORMAL', 1);
    const reservationExpiry = new Date(Date.now() - 2_000);
    const orderExpiry = new Date(Date.now() - 1_000);
    const paidAt = new Date(reservationExpiry.getTime() - 1_000);
    await prisma.payment.update({ where: { id: payment.id }, data: { paidAt } });
    await prisma.order.update({ where: { id: order.id }, data: { expiresAt: orderExpiry } });
    await prisma.inventoryReservation.updateMany({
      where: { orderId: order.id },
      data: { expiresAt: reservationExpiry },
    });
    await activation.processOne(order.id);
    expect(await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).toMatchObject({
      status: 'ACTIVE',
    });
  });

  it('reconciles payment after the reservation expiry', async () => {
    const { order, payment } = await paidOrder('NORMAL', 1);
    const paidAt = new Date(order.expiresAt.getTime() - 2_000);
    await prisma.payment.update({ where: { id: payment.id }, data: { paidAt } });
    await prisma.inventoryReservation.updateMany({
      where: { orderId: order.id },
      data: { expiresAt: new Date(paidAt.getTime() - 1) },
    });
    await activation.processOne(order.id);
    expect((await issueFor(order.id)).type).toBe('LATE_PAYMENT');
  });

  it.each(['RELEASED', 'EXPIRED', 'CONSUMED'] as const)(
    'fails closed for a %s reservation',
    async (status) => {
      const { fixture, order } = await paidOrder('NORMAL', 1);
      await prisma.inventoryReservation.updateMany({
        where: { orderId: order.id },
        data: { status },
      });
      await activation.processOne(order.id);
      await expectUnchanged(order.id, fixture.product.id, 1);
      expect((await issueFor(order.id)).details).toMatchObject({
        errorCode: 'RESERVATION_NOT_ACTIVE',
      });
    },
  );

  it.each(['releasedAt', 'consumedAt', 'releaseReason'] as const)(
    'rejects ACTIVE reservation with inconsistent %s',
    async (field) => {
      const { fixture, order } = await paidOrder('NORMAL', 1);
      await prisma.inventoryReservation.updateMany({
        where: { orderId: order.id },
        data: field === 'releaseReason' ? { releaseReason: 'CORRUPT' } : { [field]: new Date() },
      });
      await activation.processOne(order.id);
      await expectUnchanged(order.id, fixture.product.id, 1);
      expect((await issueFor(order.id)).details).toMatchObject({
        errorCode: 'RESERVATION_METADATA_MISMATCH',
      });
    },
  );

  it.each(['NORMAL', 'DYNAMIC'] as const)('rejects a missing %s reservation', async (model) => {
    const { order } = await paidOrder(model);
    await prisma.inventoryReservation.deleteMany({ where: { orderId: order.id } });
    await activation.processOne(order.id);
    expect((await issueFor(order.id)).details).toMatchObject({ errorCode: 'RESERVATION_MISSING' });
  });

  it.each(['product', 'variant', 'quantity', 'item'] as const)(
    'rejects a reservation %s mismatch',
    async (mismatch) => {
      const context = await paidOrder(mismatch === 'variant' ? 'DYNAMIC' : 'NORMAL');
      if (mismatch === 'quantity')
        await prisma.inventoryReservation.updateMany({
          where: { orderId: context.order.id },
          data: { quantity: 2 },
        });
      else if (mismatch === 'variant')
        await prisma.inventoryReservation.updateMany({
          where: { orderId: context.order.id },
          data: { productVariantId: context.fixture.product.variants[1].id },
        });
      else {
        const other = await paidOrder(mismatch === 'item' ? 'SERVICE' : 'NORMAL');
        await prisma.inventoryReservation.updateMany({
          where: { orderId: context.order.id },
          data:
            mismatch === 'product'
              ? { productId: other.fixture.product.id }
              : {
                  orderItemId: (
                    await prisma.orderItem.findFirstOrThrow({ where: { orderId: other.order.id } })
                  ).id,
                },
        });
      }
      await activation.processOne(context.order.id);
      expect((await issueFor(context.order.id)).details).toMatchObject({
        errorCode: mismatch === 'item' ? 'RESERVATION_MISSING' : 'RESERVATION_MISMATCH',
      });
    },
  );

  it.each(['NORMAL', 'DYNAMIC'] as const)(
    'rolls back when %s physical stock is unavailable',
    async (model) => {
      const { fixture, order, selectedVariantId } = await paidOrder(model, 1);
      if (model === 'NORMAL')
        await prisma.product.update({ where: { id: fixture.product.id }, data: { stock: 0 } });
      else
        await prisma.productVariant.update({
          where: { id: selectedVariantId! },
          data: { stock: 0 },
        });
      await activation.processOne(order.id);
      expect(
        await prisma.inventoryReservation.findFirstOrThrow({ where: { orderId: order.id } }),
      ).toMatchObject({ status: 'ACTIVE' });
      expect(await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).toMatchObject({
        status: 'PENDING_PAYMENT',
      });
      expect((await issueFor(order.id)).details).toMatchObject({
        errorCode: 'RESERVED_STOCK_UNAVAILABLE',
      });
      expect(
        await prisma.orderEvent.count({
          where: {
            orderId: order.id,
            type: { in: ['ORDER_ACTIVATED', 'INVENTORY_CONSUMED'] },
          },
        }),
      ).toBe(0);
      expect(
        await prisma.outboxEvent.count({
          where: {
            aggregateId: order.id,
            eventType: { in: ['ORDER_ACTIVATED', 'INVENTORY_CONSUMED'] },
          },
        }),
      ).toBe(0);
      const stock =
        model === 'DYNAMIC'
          ? (
              await prisma.productVariant.findUniqueOrThrow({
                where: { id: selectedVariantId! },
              })
            ).stock
          : (await prisma.product.findUniqueOrThrow({ where: { id: fixture.product.id } })).stock;
      expect(stock).toBe(0);
    },
  );

  it('rolls back all stock and reservations when one of multiple reservations fails', async () => {
    const { fixture, order } = await paidOrder('NORMAL', 1);
    const original = await prisma.orderItem.findFirstOrThrow({ where: { orderId: order.id } });
    const rows = await prisma.$queryRaw<Array<{ id: string }>>`
      INSERT INTO "OrderItem" ("id", "orderId", "sourceProductId", "sourceProductVersion",
        "sellerProfileId", "sellerStoreName", "sellerSlug", "productSlug", "productTitle",
        "productType", "productModel", "deliveryMode", "unitAmountMinor", "quantity",
        "lineTotalAmountMinor", "currency", "pricingPolicyVersion")
      SELECT gen_random_uuid(), "orderId", "sourceProductId", "sourceProductVersion",
        "sellerProfileId", "sellerStoreName", "sellerSlug", "productSlug", "productTitle",
        "productType", "productModel", "deliveryMode", "unitAmountMinor", "quantity",
        "lineTotalAmountMinor", "currency", "pricingPolicyVersion"
      FROM "OrderItem" WHERE "id" = ${original.id}::uuid RETURNING "id"
    `;
    await prisma.inventoryReservation.create({
      data: {
        orderId: order.id,
        orderItemId: rows[0].id,
        productId: fixture.product.id,
        quantity: 1,
        expiresAt: order.expiresAt,
      },
    });
    await activation.processOne(order.id);
    expect(
      await prisma.product.findUniqueOrThrow({ where: { id: fixture.product.id } }),
    ).toMatchObject({ stock: 1 });
    expect(
      await prisma.inventoryReservation.count({ where: { orderId: order.id, status: 'ACTIVE' } }),
    ).toBe(2);
    expect(await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).toMatchObject({
      status: 'PENDING_PAYMENT',
    });
    expect(
      await prisma.orderEvent.count({
        where: {
          orderId: order.id,
          type: { in: ['ORDER_ACTIVATED', 'INVENTORY_CONSUMED'] },
        },
      }),
    ).toBe(0);
    expect(
      await prisma.outboxEvent.count({
        where: {
          aggregateId: order.id,
          eventType: { in: ['ORDER_ACTIVATED', 'INVENTORY_CONSUMED'] },
        },
      }),
    ).toBe(0);
  });

  it('activates a paid order after its product is removed', async () => {
    const { fixture, order } = await paidOrder('NORMAL');
    await prisma.product.update({ where: { id: fixture.product.id }, data: { status: 'REMOVED' } });
    await activation.processOne(order.id);
    expect(await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).toMatchObject({
      status: 'ACTIVE',
    });
  });

  it('continues expiring an actually unpaid order and its reservation', async () => {
    const { order, payment } = await paidOrder('NORMAL');
    await prisma.payment.update({ where: { id: payment.id }, data: { status: 'PENDING' } });
    await prisma.order.update({
      where: { id: order.id },
      data: { expiresAt: new Date(Date.now() - 1) },
    });
    await expiration.expire();
    expect(await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).toMatchObject({
      status: 'EXPIRED',
    });
    expect(
      await prisma.inventoryReservation.findFirstOrThrow({ where: { orderId: order.id } }),
    ).toMatchObject({ status: 'EXPIRED' });
  });

  it('revalidates Payment after expiration candidate selection', async () => {
    const { order, payment } = await paidOrder('NORMAL');
    await prisma.payment.update({ where: { id: payment.id }, data: { status: 'PENDING' } });
    await prisma.order.update({
      where: { id: order.id },
      data: { expiresAt: new Date(Date.now() - 1) },
    });
    let unblock!: () => void;
    let locked!: () => void;
    const lockReady = new Promise<void>((resolve) => (locked = resolve));
    const release = new Promise<void>((resolve) => (unblock = resolve));
    const blocker = prisma.$transaction(async (tx) => {
      await acquireAdvisoryTransactionLock(tx, `order:${order.id}`);
      locked();
      await release;
    });
    await lockReady;
    const expiring = expiration.expire();
    await new Promise((resolve) => setTimeout(resolve, 100));
    await prisma.payment.update({ where: { id: payment.id }, data: { status: 'PAID' } });
    unblock();
    await Promise.all([blocker, expiring]);
    expect(await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).toMatchObject({
      status: 'PENDING_PAYMENT',
    });
    expect(
      await prisma.inventoryReservation.findFirstOrThrow({ where: { orderId: order.id } }),
    ).toMatchObject({ status: 'ACTIVE' });
  });

  it.each([
    ['NORMAL', 'activation-first'],
    ['NORMAL', 'checkout-first'],
    ['DYNAMIC', 'activation-first'],
    ['DYNAMIC', 'checkout-first'],
  ] as const)('does not expose phantom %s stock with %s lock ordering', async (model, ordering) => {
    const { fixture, order, selectedVariantId, otherVariantId } = await paidOrder(model, 1);
    const buyer = await prisma.user.create({
      data: {
        email: `competing-${crypto.randomUUID()}@test.local`,
        birthDate: new Date('2000-01-01'),
        status: 'ACTIVE',
        termsVersion: 't',
        termsAcceptedAt: new Date(),
        privacyVersion: 'p',
        privacyAcceptedAt: new Date(),
        roleAssignments: { create: { role: 'BUYER' } },
      },
    });
    const preview = await carts.add(buyer.id, fixture.seller.slug, {
      productId: fixture.product.id,
      productVariantId: selectedVariantId,
      quantity: 1,
      expectedVersion: 0,
    });
    const stockKey =
      model === 'DYNAMIC'
        ? `checkout-stock:variant:${selectedVariantId}`
        : `checkout-stock:product:${fixture.product.id}`;
    let unblock!: () => void;
    let locked!: () => void;
    const ready = new Promise<void>((resolve) => (locked = resolve));
    const release = new Promise<void>((resolve) => (unblock = resolve));
    const blocker = prisma.$transaction(async (tx) => {
      await acquireAdvisoryTransactionLock(tx, stockKey);
      locked();
      await release;
    });
    await ready;
    const runActivation = () => activation.processOne(order.id);
    const runCheckout = () =>
      checkout.create(buyer.id, parseIdempotencyKey(`competing:${crypto.randomUUID()}`), {
        sellerSlug: fixture.seller.slug,
        expectedCartVersion: preview.version,
        expectedPreviewFingerprint: preview.previewFingerprint,
      });
    const first = ordering === 'activation-first' ? runActivation() : runCheckout();
    await new Promise((resolve) => setTimeout(resolve, 100));
    const second = ordering === 'activation-first' ? runCheckout() : runActivation();
    await new Promise((resolve) => setTimeout(resolve, 100));
    unblock();
    const [firstResult, secondResult] = await Promise.allSettled([first, second]);
    await blocker;
    const activationResult = ordering === 'activation-first' ? firstResult : secondResult;
    const checkoutResult = ordering === 'activation-first' ? secondResult : firstResult;
    expect(activationResult.status).toBe('fulfilled');
    expect(checkoutResult).toMatchObject({
      status: 'rejected',
      reason: { code: 'INSUFFICIENT_STOCK' },
    });
    expect(await prisma.order.count()).toBe(1);
    expect(await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).toMatchObject({
      status: 'ACTIVE',
    });
    expect(
      await prisma.inventoryReservation.findFirstOrThrow({ where: { orderId: order.id } }),
    ).toMatchObject({
      status: 'CONSUMED',
      productVariantId: selectedVariantId,
    });
    if (model === 'DYNAMIC') {
      expect(
        await prisma.productVariant.findUniqueOrThrow({ where: { id: selectedVariantId! } }),
      ).toMatchObject({ stock: 0 });
      expect(
        await prisma.productVariant.findUniqueOrThrow({ where: { id: otherVariantId! } }),
      ).toMatchObject({ stock: 1 });
    } else {
      expect(
        await prisma.product.findUniqueOrThrow({ where: { id: fixture.product.id } }),
      ).toMatchObject({ stock: 0 });
    }
  });

  it('rolls back a database failure after stock updates and retries cleanly', async () => {
    const { fixture, order } = await paidOrder('NORMAL', 2);
    await prisma.$executeRawUnsafe(`
      CREATE FUNCTION reject_test_activation() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.status = 'ACTIVE' AND OLD.status = 'PENDING_PAYMENT' THEN
          RAISE EXCEPTION 'injected activation failure';
        END IF;
        RETURN NEW;
      END; $$
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER reject_test_activation BEFORE UPDATE ON "Order"
      FOR EACH ROW EXECUTE FUNCTION reject_test_activation()
    `);
    try {
      await expect(activation.processOne(order.id)).rejects.toThrow('injected activation failure');
      await expectUnchanged(order.id, fixture.product.id, 2);
      expect(
        await prisma.inventoryReservation.findFirstOrThrow({ where: { orderId: order.id } }),
      ).toMatchObject({ status: 'ACTIVE' });
    } finally {
      await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS reject_test_activation ON "Order"');
      await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS reject_test_activation()');
    }
    await activation.processOne(order.id);
    expect(await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).toMatchObject({
      status: 'ACTIVE',
    });
    expect(
      await prisma.product.findUniqueOrThrow({ where: { id: fixture.product.id } }),
    ).toMatchObject({ stock: 1 });
  });

  it('does not stop concurrent batches after both workers initially collide', async () => {
    const first = await paidOrder('SERVICE');
    const second = await paidOrder('SERVICE');
    let unblock!: () => void;
    let locked!: () => void;
    const ready = new Promise<void>((resolve) => (locked = resolve));
    const release = new Promise<void>((resolve) => (unblock = resolve));
    const blocker = prisma.$transaction(async (tx) => {
      await acquireAdvisoryTransactionLock(tx, `order:${first.order.id}`);
      locked();
      await release;
    });
    await ready;
    const workers = [activation.processBatch(2), activation.processBatch(2)];
    await new Promise((resolve) => setTimeout(resolve, 100));
    unblock();
    const [, ...processed] = await Promise.all([blocker, ...workers]);
    expect(processed.reduce((sum, count) => sum + count, 0)).toBe(2);
    expect(
      await prisma.order.count({
        where: { id: { in: [first.order.id, second.order.id] }, status: 'ACTIVE' },
      }),
    ).toBe(2);
  });
});
