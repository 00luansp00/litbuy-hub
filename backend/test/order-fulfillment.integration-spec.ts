import { randomUUID, createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { CartsService } from '../src/carts/carts.service';
import { parseIdempotencyKey } from '../src/commerce/idempotency-key';
import { CheckoutService } from '../src/checkout/checkout.service';
import { PrismaService } from '../src/database/prisma.service';
import { SaleFinancialRecognitionService } from '../src/financial/sale-financial-recognition.service';
import { OrderFulfillmentService } from '../src/orders/order-fulfillment.service';
import { PaidOrderActivationService } from '../src/orders/paid-order-activation.service';
import { commerceFixture, publishPlatformCommissionPolicy } from './order-checkout-test.helpers';

const cleanupSql = 'TRUNCATE TABLE "User", "CatalogCategory" CASCADE';

describe('OrderFulfillmentService with real PostgreSQL', () => {
  jest.setTimeout(120_000);
  let app: Awaited<ReturnType<ReturnType<typeof Test.createTestingModule>['compile']>>;
  let prisma: PrismaService;
  let cleanup: PrismaClient;
  let carts: CartsService;
  let checkout: CheckoutService;
  let activation: PaidOrderActivationService;
  let recognition: SaleFinancialRecognitionService;
  let fulfillment: OrderFulfillmentService;
  let policyVersion = 50_000;

  beforeAll(async () => {
    cleanup = new PrismaClient();
    app = await Test.createTestingModule({ imports: [AppModule] }).compile();
    prisma = app.get(PrismaService);
    carts = app.get(CartsService);
    checkout = app.get(CheckoutService);
    activation = app.get(PaidOrderActivationService);
    recognition = app.get(SaleFinancialRecognitionService);
    fulfillment = app.get(OrderFulfillmentService);
  });
  beforeEach(() => cleanup.$executeRawUnsafe(cleanupSql));
  afterAll(async () => {
    await app.close();
    await cleanup.$executeRawUnsafe(cleanupSql);
    await cleanup.$disconnect();
  });

  async function activePaid(recognized = true) {
    const fixture = await commerceFixture(prisma, 'NORMAL', undefined, 20, false);
    await publishPlatformCommissionPolicy(prisma, fixture.sellerUser.id, {
      publicVersion: policyVersion++,
      fixedAmountMinor: 100n,
    });
    const cart = await carts.add(fixture.buyer.id, fixture.seller.slug, {
      productId: fixture.product.id,
      quantity: 1,
      expectedVersion: 0,
    });
    const checkoutResult = await checkout.create(
      fixture.buyer.id,
      parseIdempotencyKey(`fulfillment:${randomUUID()}`),
      {
        sellerSlug: fixture.seller.slug,
        expectedCartVersion: cart.version,
        expectedPreviewFingerprint: cart.previewFingerprint,
      },
    );
    const order = await prisma.order.findUniqueOrThrow({
      where: { publicCode: (checkoutResult as { orderCode: string }).orderCode },
    });
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
        externalPaymentId: `pay-${randomUUID()}`,
        idempotencyKeyHash: randomUUID(),
        requestHash: randomUUID(),
      },
    });
    await prisma.order.update({ where: { id: order.id }, data: { paymentStatus: 'PENDING' } });
    await activation.processOne(order.id);
    if (recognized) await recognition.processOne(order.id);
    return { fixture, order: await prisma.order.findUniqueOrThrow({ where: { id: order.id } }) };
  }

  it('runs the authoritative flow with one event/outbox and one version increment per edge', async () => {
    const { fixture, order } = await activePaid();
    const initialVersion = order.version;
    expect(await fulfillment.makeAvailable(order.id)).toBe(true);
    expect(await fulfillment.makeAvailable(order.id)).toBe(false);
    await fulfillment.recordDelivered({
      orderCode: order.publicCode,
      actorUserId: fixture.sellerUser.id,
      deliveryType: 'MANUAL_REFERENCE',
      evidenceHash: createHash('sha256').update('opaque internal delivery evidence').digest('hex'),
    });
    await fulfillment.confirmReceipt(order.publicCode, fixture.buyer.id);
    await fulfillment.confirmReceipt(order.publicCode, fixture.buyer.id);
    const final = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(final).toMatchObject({ status: 'COMPLETED', fulfillmentStatus: 'CONFIRMED' });
    expect(final.version).toBe(initialVersion + 5);
    const types = [
      'FULFILLMENT_AVAILABLE',
      'FULFILLMENT_DELIVERED',
      'FULFILLMENT_AWAITING_BUYER_CONFIRMATION',
      'FULFILLMENT_CONFIRMED',
      'ORDER_COMPLETED',
    ] as const;
    for (const type of types) {
      expect(await prisma.orderEvent.count({ where: { orderId: order.id, type } })).toBe(1);
    }
    expect(
      await prisma.outboxEvent.count({
        where: {
          aggregateId: order.id,
          eventType: {
            in: [
              'fulfillment.available',
              'fulfillment.delivered',
              'fulfillment.awaiting_buyer_confirmation',
              'fulfillment.confirmed',
              'order.completed',
            ],
          },
        },
      }),
    ).toBe(5);
    expect(await prisma.orderDelivery.count({ where: { orderId: order.id } })).toBe(1);
  });

  it('serializes availability, delivery, confirmation, and completion replays', async () => {
    const { fixture, order } = await activePaid();
    await Promise.all([fulfillment.makeAvailable(order.id), fulfillment.makeAvailable(order.id)]);
    const input = {
      orderCode: order.publicCode,
      actorUserId: fixture.sellerUser.id,
      deliveryType: 'MANUAL_REFERENCE' as const,
      evidenceHash: 'a'.repeat(64),
    };
    await Promise.all(Array.from({ length: 6 }, () => fulfillment.recordDelivered(input)));
    await Promise.all(
      Array.from({ length: 6 }, () =>
        fulfillment.confirmReceipt(order.publicCode, fixture.buyer.id),
      ),
    );
    await Promise.all([
      fulfillment.processCompletion(order.id),
      fulfillment.processCompletion(order.id),
    ]);
    expect(await prisma.orderDelivery.count({ where: { orderId: order.id } })).toBe(1);
    expect(
      await prisma.orderEvent.count({ where: { orderId: order.id, type: 'ORDER_COMPLETED' } }),
    ).toBe(1);
  });

  it('is IDOR-safe and blocks active disputes', async () => {
    const { fixture, order } = await activePaid();
    await fulfillment.makeAvailable(order.id);
    await expect(
      fulfillment.recordDelivered({
        orderCode: order.publicCode,
        actorUserId: fixture.buyer.id,
        deliveryType: 'MANUAL_REFERENCE',
        evidenceHash: 'b'.repeat(64),
      }),
    ).rejects.toMatchObject({ status: 404 });
    await fulfillment.recordDelivered({
      orderCode: order.publicCode,
      actorUserId: fixture.sellerUser.id,
      deliveryType: 'MANUAL_REFERENCE',
      evidenceHash: 'c'.repeat(64),
    });
    await prisma.order.update({ where: { id: order.id }, data: { disputeStatus: 'OPEN' } });
    await expect(
      fulfillment.confirmReceipt(order.publicCode, fixture.buyer.id),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('fails closed and reconciles when SALE_RECOGNIZED is missing', async () => {
    const { fixture, order } = await activePaid(false);
    await fulfillment.makeAvailable(order.id);
    await fulfillment.recordDelivered({
      orderCode: order.publicCode,
      actorUserId: fixture.sellerUser.id,
      deliveryType: 'AUTOMATED_REFERENCE',
      evidenceHash: 'd'.repeat(64),
    });
    await fulfillment.confirmReceipt(order.publicCode, fixture.buyer.id);
    expect(await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).toMatchObject({
      status: 'ACTIVE',
      fulfillmentStatus: 'CONFIRMED',
    });
    const issue = await prisma.reconciliationIssue.findFirstOrThrow({
      where: { referenceType: 'OrderFulfillment', referenceId: order.id },
    });
    expect(issue.details).toEqual({ errorCode: 'SALE_RECOGNITION_MISSING' });
  });

  it('has no financial posting or secret-transport dependency', () => {
    const service = readFileSync(
      join(process.cwd(), 'src/orders/order-fulfillment.service.ts'),
      'utf8',
    );
    const dto = readFileSync(join(process.cwd(), 'src/orders/order-fulfillment.dto.ts'), 'utf8');
    expect(service).not.toMatch(
      /FinancialLedgerService|postWithOutcome|ledgerEntry\.create|ledgerTransaction\.create/,
    );
    expect(dto).not.toMatch(
      /secureReference|password|licenseKey|activationCode|secret|token|credential|url/i,
    );
  });
});
