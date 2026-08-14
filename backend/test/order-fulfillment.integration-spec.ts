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
import { FinancialLedgerService } from '../src/financial/financial-ledger.service';
import { SaleFinancialRecognitionService } from '../src/financial/sale-financial-recognition.service';
import { OrderFulfillmentService } from '../src/orders/order-fulfillment.service';
import { PaidOrderActivationService } from '../src/orders/paid-order-activation.service';
import { PaidOrderAvailabilityOrchestrator } from '../src/orders/paid-order-availability.orchestrator';
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
  let ledger: FinancialLedgerService;
  let fulfillment: OrderFulfillmentService;
  let availability: PaidOrderAvailabilityOrchestrator;
  let policyVersion = 50_000;

  beforeAll(async () => {
    cleanup = new PrismaClient();
    app = await Test.createTestingModule({ imports: [AppModule] }).compile();
    prisma = app.get(PrismaService);
    carts = app.get(CartsService);
    checkout = app.get(CheckoutService);
    activation = app.get(PaidOrderActivationService);
    recognition = app.get(SaleFinancialRecognitionService);
    ledger = app.get(FinancialLedgerService);
    fulfillment = app.get(OrderFulfillmentService);
    availability = app.get(PaidOrderAvailabilityOrchestrator);
  });
  beforeEach(() => cleanup.$executeRawUnsafe(cleanupSql));
  afterAll(async () => {
    await app.close();
    await cleanup.$executeRawUnsafe(cleanupSql);
    await cleanup.$disconnect();
  });

  async function activePaid(recognized = true) {
    const fixture = await commerceFixture(prisma, 'NORMAL', undefined, 20, false);
    const activePolicy = await prisma.feePolicyVersion.findFirst({ where: { status: 'ACTIVE' } });
    if (!activePolicy)
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

  async function makeAwaiting(recognized = true) {
    const value = await activePaid(recognized);
    await fulfillment.makeAvailable(value.order.id);
    return value;
  }

  async function deliver(recognized = true, evidenceHash = 'a'.repeat(64)) {
    const value = await makeAwaiting(recognized);
    await fulfillment.recordDelivered({
      orderCode: value.order.publicCode,
      actorUserId: value.fixture.sellerUser.id,
      deliveryType: 'MANUAL_REFERENCE',
      evidenceHash,
    });
    return value;
  }

  async function financialCounts() {
    return {
      transactions: await prisma.ledgerTransaction.count(),
      entries: await prisma.ledgerEntry.count(),
      events: await prisma.financialEvent.count(),
      outbox: await prisma.financialOutboxEvent.count(),
      settlements: await prisma.settlement.count(),
      holds: await prisma.financialHold.count(),
    };
  }

  it('runs the authoritative flow with one event/outbox and one version increment per edge', async () => {
    const { fixture, order } = await activePaid();
    const financialBaseline = await financialCounts();
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
    expect(await financialCounts()).toEqual(financialBaseline);
    const sellerEntries = await prisma.ledgerEntry.findMany({
      where: { account: { sellerProfileId: fixture.seller.id } },
      include: { account: true },
    });
    const balance = (purpose: string) =>
      sellerEntries
        .filter(({ account }) => account.purpose === purpose)
        .reduce(
          (sum, entry) =>
            sum + (entry.direction === 'CREDIT' ? entry.amountMinor : -entry.amountMinor),
          0n,
        );
    expect(balance('SELLER_PENDING')).toBe(order.totalAmountMinor - order.platformFeeAmountMinor);
    expect(balance('SELLER_HELD')).toBe(0n);
    expect(balance('SELLER_AVAILABLE')).toBe(0n);
    expect(balance('SELLER_RESERVED')).toBe(0n);
  });

  it('orchestrates an already active paid order and treats availability replay as success', async () => {
    const { order } = await activePaid(false);
    const initialVersion = order.version;
    const financialBaseline = await financialCounts();

    await availability.ensureAvailable(order.id);
    await availability.ensureAvailable(order.id);

    expect(await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).toMatchObject({
      status: 'ACTIVE',
      paymentStatus: 'PAID',
      fulfillmentStatus: 'AWAITING_SELLER',
      version: initialVersion + 1,
    });
    expect(
      await prisma.orderEvent.count({
        where: { orderId: order.id, type: 'FULFILLMENT_AVAILABLE' },
      }),
    ).toBe(1);
    expect(
      await prisma.outboxEvent.count({
        where: { aggregateId: order.id, eventType: 'fulfillment.available' },
      }),
    ).toBe(1);
    expect(await financialCounts()).toEqual(financialBaseline);
    expect(
      await prisma.ledgerTransaction.count({
        where: { type: 'SALE_RECOGNIZED', referenceId: order.id },
      }),
    ).toBe(0);
  });

  it('fails closed for active fulfillment reconciliation in direct and batch paths', async () => {
    for (const status of ['OPEN', 'INVESTIGATING'] as const) {
      const { order } = await activePaid(false);
      await prisma.reconciliationIssue.create({
        data: {
          type: 'OTHER',
          referenceType: 'OrderFulfillment',
          referenceId: order.id,
          status,
          details: { errorCode: 'TEST_QUARANTINE' },
        },
      });

      expect(await fulfillment.makeAvailable(order.id)).toBe(false);
      await expect(availability.ensureAvailable(order.id)).rejects.toMatchObject({ status: 409 });
      expect(await fulfillment.processAvailabilityBatch()).toBe(0);
      expect(await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).toMatchObject({
        fulfillmentStatus: 'NOT_AVAILABLE',
      });
    }
  });

  it('recovers stuck availability in a finite batch and replays without duplication', async () => {
    const first = await activePaid(false);
    const second = await activePaid(false);
    const ids = [first.order.id, second.order.id];

    expect(await fulfillment.processAvailabilityBatch()).toBe(2);
    expect(await fulfillment.processAvailabilityBatch()).toBe(0);
    expect(
      await prisma.order.count({
        where: { id: { in: ids }, fulfillmentStatus: 'AWAITING_SELLER' },
      }),
    ).toBe(2);
    expect(
      await prisma.orderEvent.count({
        where: { orderId: { in: ids }, type: 'FULFILLMENT_AVAILABLE' },
      }),
    ).toBe(2);
    expect(
      await prisma.outboxEvent.count({
        where: { aggregateId: { in: ids }, eventType: 'fulfillment.available' },
      }),
    ).toBe(2);
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
    await expect(
      fulfillment.confirmReceipt(order.publicCode, fixture.buyer.id),
    ).rejects.toMatchObject({ status: 409 });
    expect(await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).toMatchObject({
      status: 'ACTIVE',
      fulfillmentStatus: 'CONFIRMED',
    });
    const issue = await prisma.reconciliationIssue.findFirstOrThrow({
      where: { referenceType: 'OrderFulfillment', referenceId: order.id },
    });
    expect(issue.details).toEqual({ errorCode: 'SALE_RECOGNITION_MISSING' });
  });

  it('commits and deduplicates reconciliation before returning a public conflict', async () => {
    const { fixture, order } = await makeAwaiting();
    await prisma.payment.update({ where: { orderId: order.id }, data: { status: 'FAILED' } });
    const input = {
      orderCode: order.publicCode,
      actorUserId: fixture.sellerUser.id,
      deliveryType: 'MANUAL_REFERENCE' as const,
      evidenceHash: '1'.repeat(64),
    };
    const outcomes = await Promise.allSettled(
      Array.from({ length: 6 }, () => fulfillment.recordDelivered(input)),
    );
    expect(outcomes.every(({ status }) => status === 'rejected')).toBe(true);
    const issues = await prisma.reconciliationIssue.findMany({
      where: {
        referenceType: 'OrderFulfillment',
        referenceId: order.id,
        status: { in: ['OPEN', 'INVESTIGATING'] },
      },
    });
    expect(issues).toHaveLength(1);
    expect(issues[0].details).toEqual({ errorCode: 'PAYMENT_NOT_PAID' });
  });

  it('reconciles an authoritative missing Payment and leaves delivery untouched', async () => {
    const { fixture, order } = await makeAwaiting();
    await prisma.paymentAttempt.deleteMany({ where: { payment: { orderId: order.id } } });
    await prisma.payment.delete({ where: { orderId: order.id } });
    await expect(
      fulfillment.recordDelivered({
        orderCode: order.publicCode,
        actorUserId: fixture.sellerUser.id,
        deliveryType: 'MANUAL_REFERENCE',
        evidenceHash: '2'.repeat(64),
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(await prisma.orderDelivery.count({ where: { orderId: order.id } })).toBe(0);
    const issue = await prisma.reconciliationIssue.findFirstOrThrow({
      where: { referenceType: 'OrderFulfillment', referenceId: order.id },
    });
    expect(issue.details).toEqual({ errorCode: 'PAYMENT_MISSING' });
  });

  it('enforces the order/seller composite foreign key in PostgreSQL', async () => {
    const { order, fixture } = await makeAwaiting();
    const foreign = await commerceFixture(prisma, 'NORMAL', undefined, 1, false);
    await prisma.$executeRaw`
      INSERT INTO "OrderDelivery" ("id", "orderId", "sellerProfileId", "deliveryType", "evidenceHash", "createdAt", "updatedAt")
      VALUES (${randomUUID()}::uuid, ${order.id}::uuid, ${fixture.seller.id}::uuid, 'MANUAL_REFERENCE', ${'3'.repeat(64)}, NOW(), NOW())
    `;
    await prisma.orderDelivery.delete({ where: { orderId: order.id } });
    await expect(prisma.$executeRaw`
      INSERT INTO "OrderDelivery" ("id", "orderId", "sellerProfileId", "deliveryType", "evidenceHash", "createdAt", "updatedAt")
      VALUES (${randomUUID()}::uuid, ${order.id}::uuid, ${foreign.seller.id}::uuid, 'MANUAL_REFERENCE', ${'3'.repeat(64)}, NOW(), NOW())
    `).rejects.toBeDefined();
  });

  it.each([
    ['short', 'a'.repeat(63)],
    ['non-hex', `${'a'.repeat(63)}z`],
    ['spaces', ` ${'a'.repeat(63)}`],
    ['uppercase', 'A'.repeat(64)],
  ])('rejects %s evidence hashes directly in PostgreSQL', async (_case, hash) => {
    const { order, fixture } = await makeAwaiting();
    await expect(prisma.$executeRaw`
      INSERT INTO "OrderDelivery" ("id", "orderId", "sellerProfileId", "deliveryType", "evidenceHash", "createdAt", "updatedAt")
      VALUES (${randomUUID()}::uuid, ${order.id}::uuid, ${fixture.seller.id}::uuid, 'MANUAL_REFERENCE', ${hash}, NOW(), NOW())
    `).rejects.toBeDefined();
  });

  it('normalizes an uppercase DTO hash and accepts exact but rejects mutated delivery replays', async () => {
    const { fixture, order } = await makeAwaiting();
    const input = {
      orderCode: order.publicCode,
      actorUserId: fixture.sellerUser.id,
      deliveryType: 'MANUAL_REFERENCE' as const,
      evidenceHash: 'A'.repeat(64),
    };
    await fulfillment.recordDelivered(input);
    const before = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    await fulfillment.recordDelivered(input);
    const delivery = await prisma.orderDelivery.findUniqueOrThrow({ where: { orderId: order.id } });
    expect(delivery.evidenceHash).toBe('a'.repeat(64));
    await expect(
      fulfillment.recordDelivered({ ...input, evidenceHash: 'b'.repeat(64) }),
    ).rejects.toMatchObject({
      status: 409,
      response: { code: 'DELIVERY_IDEMPOTENCY_MISMATCH' },
    });
    await expect(
      fulfillment.recordDelivered({ ...input, deliveryType: 'AUTOMATED_REFERENCE' }),
    ).rejects.toMatchObject({
      status: 409,
      response: { code: 'DELIVERY_IDEMPOTENCY_MISMATCH' },
    });
    expect(await prisma.orderDelivery.findUniqueOrThrow({ where: { orderId: order.id } })).toEqual(
      delivery,
    );
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).version).toBe(
      before.version,
    );
  });

  it('recovers completion only after the reconciliation issue is explicitly resolved', async () => {
    const { fixture, order } = await deliver(false, '4'.repeat(64));
    await expect(
      fulfillment.confirmReceipt(order.publicCode, fixture.buyer.id),
    ).rejects.toMatchObject({ status: 409 });
    const confirmed = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    const confirmedEvents = await prisma.orderEvent.count({
      where: { orderId: order.id, type: 'FULFILLMENT_CONFIRMED' },
    });
    await expect(
      fulfillment.confirmReceipt(order.publicCode, fixture.buyer.id),
    ).resolves.toMatchObject({ status: 'ACTIVE' });
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).version).toBe(
      confirmed.version,
    );
    expect(
      await prisma.orderEvent.count({
        where: { orderId: order.id, type: 'FULFILLMENT_CONFIRMED' },
      }),
    ).toBe(confirmedEvents);
    await recognition.processOne(order.id);
    expect(await fulfillment.processCompletionBatch()).toBe(0);
    const issue = await prisma.reconciliationIssue.findFirstOrThrow({
      where: { referenceType: 'OrderFulfillment', referenceId: order.id, status: 'OPEN' },
    });
    await prisma.reconciliationIssue.update({
      where: { id: issue.id },
      data: { status: 'RESOLVED', resolvedAt: new Date() },
    });
    const counts = await Promise.all([
      fulfillment.processCompletionBatch(),
      fulfillment.processCompletionBatch(),
    ]);
    expect(counts.reduce((sum, count) => sum + count, 0)).toBe(1);
    expect(
      await prisma.orderEvent.count({ where: { orderId: order.id, type: 'ORDER_COMPLETED' } }),
    ).toBe(1);
  });

  it('reconciles a wrong SALE_RECOGNIZED deterministic key and preserves ACTIVE', async () => {
    const { fixture, order } = await deliver(false);
    const [systemAccounts, platformAccounts] = await Promise.all([
      ledger.ensureSystemLedgerAccounts(),
      ledger.ensurePlatformLedgerAccounts(),
    ]);
    await ledger.post({
      type: 'SALE_RECOGNIZED',
      currency: 'BRL',
      referenceType: 'OrderSale',
      referenceId: order.id,
      idempotencyKeyHash: createHash('sha256').update(`wrong:${order.id}`).digest('hex'),
      entries: [
        {
          accountId: systemAccounts.find(({ purpose }) => purpose === 'PROVIDER_CLEARING')!.id,
          direction: 'DEBIT',
          amountMinor: 1n,
        },
        {
          accountId: platformAccounts.find(({ purpose }) => purpose === 'PLATFORM_COMMISSION')!.id,
          direction: 'CREDIT',
          amountMinor: 1n,
        },
      ],
    });
    await expect(
      fulfillment.confirmReceipt(order.publicCode, fixture.buyer.id),
    ).rejects.toMatchObject({ status: 409 });
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe(
      'ACTIVE',
    );
    const issue = await prisma.reconciliationIssue.findFirstOrThrow({
      where: { referenceType: 'OrderFulfillment', referenceId: order.id },
    });
    expect(issue.details).toEqual({ errorCode: 'SALE_RECOGNITION_INVALID' });
  });

  it('reconciles missing delivery and commits the issue after Conflict', async () => {
    const { fixture, order } = await deliver();
    await prisma.orderDelivery.delete({ where: { orderId: order.id } });
    await expect(
      fulfillment.confirmReceipt(order.publicCode, fixture.buyer.id),
    ).rejects.toMatchObject({ status: 409 });
    expect(
      await prisma.reconciliationIssue.count({
        where: { referenceType: 'OrderFulfillment', referenceId: order.id, status: 'OPEN' },
      }),
    ).toBe(1);
  });

  it.each(['OPEN', 'UNDER_REVIEW'] as const)(
    'blocks delivery, confirmation, and completion for %s disputes without side effects',
    async (disputeStatus) => {
      const first = await makeAwaiting();
      await prisma.order.update({ where: { id: first.order.id }, data: { disputeStatus } });
      const beforeFirst = await prisma.order.findUniqueOrThrow({ where: { id: first.order.id } });
      await expect(
        fulfillment.recordDelivered({
          orderCode: first.order.publicCode,
          actorUserId: first.fixture.sellerUser.id,
          deliveryType: 'MANUAL_REFERENCE',
          evidenceHash: '5'.repeat(64),
        }),
      ).rejects.toMatchObject({ status: 409 });
      expect(await prisma.order.findUniqueOrThrow({ where: { id: first.order.id } })).toEqual(
        beforeFirst,
      );
      expect(await prisma.orderDelivery.count({ where: { orderId: first.order.id } })).toBe(0);

      const second = await deliver();
      await prisma.order.update({ where: { id: second.order.id }, data: { disputeStatus } });
      const beforeSecond = await prisma.order.findUniqueOrThrow({ where: { id: second.order.id } });
      const eventCount = await prisma.orderEvent.count({ where: { orderId: second.order.id } });
      await expect(
        fulfillment.confirmReceipt(second.order.publicCode, second.fixture.buyer.id),
      ).rejects.toMatchObject({ status: 409 });
      expect(await prisma.order.findUniqueOrThrow({ where: { id: second.order.id } })).toEqual(
        beforeSecond,
      );
      await prisma.order.update({
        where: { id: second.order.id },
        data: { fulfillmentStatus: 'CONFIRMED' },
      });
      const beforeCompletion = await prisma.order.findUniqueOrThrow({
        where: { id: second.order.id },
      });
      expect(await fulfillment.processCompletion(second.order.id)).toBe(false);
      expect(await prisma.order.findUniqueOrThrow({ where: { id: second.order.id } })).toEqual(
        beforeCompletion,
      );
      expect(await prisma.orderEvent.count({ where: { orderId: second.order.id } })).toBe(
        eventCount,
      );
      expect(
        await prisma.reconciliationIssue.count({
          where: {
            referenceType: 'OrderFulfillment',
            referenceId: { in: [first.order.id, second.order.id] },
          },
        }),
      ).toBe(0);
    },
  );

  it.each(['PENDING_PAYMENT', 'CANCELLED', 'EXPIRED', 'REFUNDED', 'CHARGEBACK'] as const)(
    'blocks the prohibited %s order state without mutation',
    async (status) => {
      const { order } = await activePaid();
      await prisma.order.update({ where: { id: order.id }, data: { status } });
      const before = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
      expect(await fulfillment.makeAvailable(order.id)).toBe(false);
      expect(await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).toEqual(before);
    },
  );

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
