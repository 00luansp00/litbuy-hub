import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { CartsService } from '../src/carts/carts.service';
import { CheckoutService } from '../src/checkout/checkout.service';
import { PaidOrderActivationService } from '../src/orders/paid-order-activation.service';
import { OrderExpirationService } from '../src/orders/order-expiration.service';
import { parseIdempotencyKey } from '../src/commerce/idempotency-key';
import { commerceFixture } from './order-checkout-test.helpers';

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
    const order = await prisma.order.findUniqueOrThrow({
      where: { publicCode: response.orderCode },
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
    return { fixture, order, payment };
  }

  it.each(['NORMAL', 'DYNAMIC', 'SERVICE'] as const)(
    'activates %s from persisted payment truth and applies only its stock rules',
    async (model) => {
      const { fixture, order } = await paidOrder(model);
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
        });
        expect(updated.reservations[0].consumedAt).toBeInstanceOf(Date);
      }
      const product = await prisma.product.findUniqueOrThrow({
        where: { id: fixture.product.id },
        include: { variants: true },
      });
      expect(
        model === 'NORMAL' ? product.stock : model === 'DYNAMIC' ? product.variants[0].stock : null,
      ).toBe(model === 'SERVICE' ? null : 4);
      expect(updated.events.filter(({ type }) => type === 'ORDER_ACTIVATED')).toHaveLength(1);
      expect(updated.events.filter(({ type }) => type === 'INVENTORY_CONSUMED')).toHaveLength(
        model === 'SERVICE' ? 0 : 1,
      );
      expect(updated.events.every(({ outbox }) => outbox?.status === 'PENDING')).toBe(true);
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
    await activation.processOne(order.id);
    expect(
      await prisma.product.findUniqueOrThrow({ where: { id: fixture.product.id } }),
    ).toMatchObject({ stock: 1 });
    expect(
      await prisma.orderEvent.count({ where: { orderId: order.id, type: 'ORDER_ACTIVATED' } }),
    ).toBe(1);
    expect(
      await prisma.orderEvent.count({ where: { orderId: order.id, type: 'INVENTORY_CONSUMED' } }),
    ).toBe(1);
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
    const { order } = await paidOrder('SERVICE');
    const issue = await prisma.reconciliationIssue.create({
      data: {
        type: 'OTHER',
        referenceType: 'OrderActivation',
        referenceId: order.id,
        details: { errorCode: 'TEST' },
      },
    });
    expect(await activation.processOne()).toBe(false);
    await prisma.reconciliationIssue.update({
      where: { id: issue.id },
      data: { status: 'RESOLVED', resolvedAt: new Date() },
    });
    expect(await activation.processOne()).toBe(true);
    expect(await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).toMatchObject({
      status: 'ACTIVE',
    });
  });
});
