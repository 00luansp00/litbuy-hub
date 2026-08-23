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
import { acquireAdvisoryTransactionLock } from '../src/database/advisory-lock';
import { FinancialLedgerService } from '../src/financial/financial-ledger.service';
import { SaleFinancialRecognitionService } from '../src/financial/sale-financial-recognition.service';
import { SellerPendingHoldService } from '../src/financial/seller-pending-hold.service';
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
  let pendingHolds: SellerPendingHoldService;
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
    pendingHolds = app.get(SellerPendingHoldService);
  });
  beforeEach(() => cleanup.$executeRawUnsafe(cleanupSql));
  afterAll(async () => {
    await app.close();
    await cleanup.$executeRawUnsafe(cleanupSql);
    await cleanup.$disconnect();
  });

  async function activePaid(recognized = true, sellerMax = false) {
    const fixture = await commerceFixture(prisma, 'NORMAL', undefined, 20, false);
    if (sellerMax) {
      await prisma.listingDraft.update({
        where: { id: fixture.product.sourceListingDraftId },
        data: { requestedSellerPlan: 'LIT_MAX' },
      });
      await prisma.product.update({
        where: { id: fixture.product.id },
        data: { sellerPlan: 'LIT_MAX' },
      });
    }
    const activePolicy = await prisma.feePolicyVersion.findFirst({ where: { status: 'ACTIVE' } });
    if (!activePolicy)
      await publishPlatformCommissionPolicy(prisma, fixture.sellerUser.id, {
        publicVersion: policyVersion++,
        percentBps: 1000,
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
        buyerVipPlan: 'NONE',
        expectedPreviewFingerprint: cart.buyerVipPreviewFingerprints.NONE,
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

  it('materializes and qualifies one Seller MAX v1 window from the delivery DB clock', async () => {
    const { fixture, order } = await activePaid(true, true);
    await fulfillment.makeAvailable(order.id);
    await fulfillment.recordDelivered({
      orderCode: order.publicCode,
      actorUserId: fixture.sellerUser.id,
      deliveryType: 'MANUAL_REFERENCE',
      evidenceHash: 'f'.repeat(64),
    });
    const delivery = await prisma.orderDelivery.findUniqueOrThrow({ where: { orderId: order.id } });
    const pending = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(pending).toMatchObject({
      sellerPlanSnapshot: 'LIT_MAX',
      sellerMaxQualificationVersion: 1,
      sellerMaxQualificationStatus: 'PENDING',
      sellerMaxQualificationDecidedAt: null,
      buyerConfirmedAt: null,
    });
    expect(pending.sellerMaxQualificationDeadlineAt!.getTime()).toBe(
      delivery.createdAt.getTime() + 48 * 60 * 60 * 1000,
    );
    const pendingVersion = pending.version;
    await pendingHolds.processOne(order.id);
    const baseHold = await prisma.financialHold.findFirstOrThrow({ where: { orderId: order.id } });
    await fulfillment.recordDelivered({
      orderCode: order.publicCode,
      actorUserId: fixture.sellerUser.id,
      deliveryType: 'MANUAL_REFERENCE',
      evidenceHash: 'f'.repeat(64),
    });
    const replayedDelivery = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(replayedDelivery.version).toBe(pendingVersion);
    expect(replayedDelivery.sellerMaxQualificationDeadlineAt).toEqual(
      pending.sellerMaxQualificationDeadlineAt,
    );
    await Promise.all([
      fulfillment.confirmReceipt(order.publicCode, fixture.buyer.id),
      fulfillment.confirmReceipt(order.publicCode, fixture.buyer.id),
    ]);
    const qualified = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(qualified).toMatchObject({
      sellerMaxQualificationStatus: 'QUALIFIED',
      buyerConfirmedAt: expect.any(Date),
      sellerMaxQualificationDecidedAt: expect.any(Date),
    });
    const decidedFacts = {
      buyerConfirmedAt: qualified.buyerConfirmedAt,
      sellerMaxQualificationDecidedAt: qualified.sellerMaxQualificationDecidedAt,
      sellerMaxQualificationDeadlineAt: qualified.sellerMaxQualificationDeadlineAt,
      version: qualified.version,
    };
    await fulfillment.confirmReceipt(order.publicCode, fixture.buyer.id);
    expect(await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).toMatchObject(
      decidedFacts,
    );
    expect(
      (await prisma.financialHold.findUniqueOrThrow({ where: { id: baseHold.id } }))
        .releaseEligibleAt,
    ).toEqual(baseHold.releaseEligibleAt);
    expect(
      await prisma.orderEvent.count({ where: { orderId: order.id, type: 'SELLER_MAX_QUALIFIED' } }),
    ).toBe(1);
    expect(
      await prisma.orderEvent.count({
        where: { orderId: order.id, type: 'SELLER_MAX_QUALIFICATION_STARTED' },
      }),
    ).toBe(1);
  });

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

  async function deliveredMax(evidenceHash = 'e'.repeat(64)) {
    const value = await activePaid(true, true);
    await fulfillment.makeAvailable(value.order.id);
    await fulfillment.recordDelivered({
      orderCode: value.order.publicCode,
      actorUserId: value.fixture.sellerUser.id,
      deliveryType: 'MANUAL_REFERENCE',
      evidenceHash,
    });
    return value;
  }

  async function pendingMax() {
    const value = await activePaid(true, true);
    await fulfillment.makeAvailable(value.order.id);
    const deliveredAt = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.orderDelivery.create({
        data: {
          orderId: value.order.id,
          sellerProfileId: value.fixture.seller.id,
          deliveryType: 'MANUAL_REFERENCE',
          evidenceHash: 'd'.repeat(64),
          createdAt: deliveredAt,
        },
      });
      await tx.$executeRaw`
        UPDATE "Order" o SET
          "fulfillmentStatus" = 'AWAITING_BUYER_CONFIRMATION',
          "sellerMaxQualificationVersion" = 1,
          "sellerMaxQualificationStatus" = 'PENDING',
          "sellerMaxQualificationDeadlineAt" = d."createdAt" + interval '48 hours',
          "version" = "version" + 2
        FROM "OrderDelivery" d
        WHERE o."id" = ${value.order.id}::uuid AND d."orderId" = o."id"
      `;
    });
    return value;
  }

  function setWallClockAfterDeadline(deadline: Date) {
    return jest
      .spyOn(
        fulfillment as unknown as { sellerMaxWallClock: (tx: unknown) => Promise<Date> },
        'sellerMaxWallClock',
      )
      .mockResolvedValue(new Date(deadline.getTime() + 1));
  }

  it('captures buyerConfirmedAt from the DB wall clock only after acquiring the order lock', async () => {
    const { fixture, order } = await deliveredMax('1'.repeat(64));
    let confirmation!: Promise<unknown>;
    let releasedAfter!: Date;
    await cleanup.$transaction(async (tx) => {
      await acquireAdvisoryTransactionLock(tx, `order:${order.id}`);
      confirmation = fulfillment.confirmReceipt(order.publicCode, fixture.buyer.id);
      await new Promise((resolve) => setTimeout(resolve, 100));
      [{ now: releasedAfter }] = await tx.$queryRaw<Array<{ now: Date }>>`
        SELECT clock_timestamp()::timestamp(3) AS "now"
      `;
    });
    await confirmation;
    const persisted = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(persisted.buyerConfirmedAt!.getTime()).toBeGreaterThanOrEqual(releasedAfter.getTime());
  });

  it('expires pending MAX exactly once and preserves the terminal decision on late confirmation', async () => {
    const { fixture, order } = await pendingMax();
    const before = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    await pendingHolds.processOne(order.id);
    const baseHold = await prisma.financialHold.findFirstOrThrow({ where: { orderId: order.id } });
    const clock = setWallClockAfterDeadline(before.sellerMaxQualificationDeadlineAt!);
    expect(await fulfillment.processSellerMaxQualificationExpiration(order.id)).toBe(true);
    const expired = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(expired).toMatchObject({
      sellerMaxQualificationStatus: 'EXPIRED',
      sellerMaxQualificationDecidedAt: expect.any(Date),
      buyerConfirmedAt: null,
      version: before.version + 1,
    });
    expect(await fulfillment.processSellerMaxQualificationExpiration(order.id)).toBe(false);
    expect(
      (await prisma.financialHold.findUniqueOrThrow({ where: { id: baseHold.id } }))
        .releaseEligibleAt,
    ).toEqual(baseHold.releaseEligibleAt);
    expect(
      await prisma.orderEvent.count({
        where: { orderId: order.id, type: 'SELLER_MAX_QUALIFICATION_EXPIRED' },
      }),
    ).toBe(1);
    expect(
      await prisma.outboxEvent.count({
        where: { aggregateId: order.id, eventType: 'seller_max.qualification_expired' },
      }),
    ).toBe(1);
    await fulfillment.confirmReceipt(order.publicCode, fixture.buyer.id);
    await fulfillment.confirmReceipt(order.publicCode, fixture.buyer.id);
    const confirmed = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(confirmed.sellerMaxQualificationStatus).toBe('EXPIRED');
    expect(confirmed.sellerMaxQualificationDecidedAt).toEqual(
      expired.sellerMaxQualificationDecidedAt,
    );
    expect(confirmed.sellerMaxQualificationDeadlineAt).toEqual(
      expired.sellerMaxQualificationDeadlineAt,
    );
    expect(confirmed.buyerConfirmedAt).toEqual(expect.any(Date));
    expect(
      await prisma.orderEvent.count({ where: { orderId: order.id, type: 'SELLER_MAX_QUALIFIED' } }),
    ).toBe(0);
    clock.mockRestore();
  });

  it('serializes confirmation against expiration and two expiration workers', async () => {
    const first = await pendingMax();
    const firstPending = await prisma.order.findUniqueOrThrow({ where: { id: first.order.id } });
    const firstClock = setWallClockAfterDeadline(firstPending.sellerMaxQualificationDeadlineAt!);
    await Promise.all([
      fulfillment.confirmReceipt(first.order.publicCode, first.fixture.buyer.id),
      fulfillment.processSellerMaxQualificationExpiration(first.order.id),
    ]);
    const raced = await prisma.order.findUniqueOrThrow({ where: { id: first.order.id } });
    expect(raced.sellerMaxQualificationStatus).toBe('EXPIRED');
    expect(raced.buyerConfirmedAt).toEqual(expect.any(Date));
    expect(
      await prisma.orderEvent.count({
        where: {
          orderId: first.order.id,
          type: { in: ['SELLER_MAX_QUALIFIED', 'SELLER_MAX_QUALIFICATION_EXPIRED'] },
        },
      }),
    ).toBe(1);
    firstClock.mockRestore();

    const second = await pendingMax();
    const initial = await prisma.order.findUniqueOrThrow({ where: { id: second.order.id } });
    const secondClock = setWallClockAfterDeadline(initial.sellerMaxQualificationDeadlineAt!);
    const results = await Promise.all([
      fulfillment.processSellerMaxQualificationExpiration(second.order.id),
      fulfillment.processSellerMaxQualificationExpiration(second.order.id),
    ]);
    expect(results.sort()).toEqual([false, true]);
    const terminal = await prisma.order.findUniqueOrThrow({ where: { id: second.order.id } });
    expect(terminal.version).toBe(initial.version + 1);
    expect(
      await prisma.orderEvent.count({
        where: { orderId: second.order.id, type: 'SELLER_MAX_QUALIFICATION_EXPIRED' },
      }),
    ).toBe(1);
    secondClock.mockRestore();
  });

  it('keeps STANDARD qualification fields null while persisting the general confirmation fact', async () => {
    const { fixture, order } = await deliver();
    const delivered = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(delivered).toMatchObject({
      sellerMaxQualificationVersion: null,
      sellerMaxQualificationStatus: null,
      sellerMaxQualificationDeadlineAt: null,
      sellerMaxQualificationDecidedAt: null,
    });
    await fulfillment.confirmReceipt(order.publicCode, fixture.buyer.id);
    const confirmed = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(confirmed.buyerConfirmedAt).toEqual(expect.any(Date));
    expect(
      await prisma.orderEvent.count({
        where: {
          orderId: order.id,
          type: {
            in: [
              'SELLER_MAX_QUALIFICATION_STARTED',
              'SELLER_MAX_QUALIFIED',
              'SELLER_MAX_QUALIFICATION_EXPIRED',
            ],
          },
        },
      }),
    ).toBe(0);
  });

  it('rejects corrupt shapes and every mutation of terminal qualification facts', async () => {
    const qualifiedValue = await deliveredMax('2'.repeat(64));
    await fulfillment.confirmReceipt(
      qualifiedValue.order.publicCode,
      qualifiedValue.fixture.buyer.id,
    );
    const qualified = await prisma.order.findUniqueOrThrow({
      where: { id: qualifiedValue.order.id },
    });
    await expect(
      prisma.$executeRaw`UPDATE "Order" SET "sellerMaxQualificationDecidedAt" = "sellerMaxQualificationDecidedAt" + interval '1 millisecond' WHERE "id" = ${qualified.id}::uuid`,
    ).rejects.toThrow();
    await expect(
      prisma.order.update({
        where: { id: qualified.id },
        data: { sellerMaxQualificationStatus: 'PENDING' },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.order.update({
        where: { id: qualified.id },
        data: { buyerConfirmedAt: new Date(qualified.buyerConfirmedAt!.getTime() + 1) },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.order.update({
        where: { id: qualified.id },
        data: {
          sellerMaxQualificationDeadlineAt: new Date(
            qualified.sellerMaxQualificationDeadlineAt!.getTime() + 1,
          ),
        },
      }),
    ).rejects.toThrow();

    const expiredValue = await pendingMax();
    const expiredPending = await prisma.order.findUniqueOrThrow({
      where: { id: expiredValue.order.id },
    });
    const expiredClock = setWallClockAfterDeadline(
      expiredPending.sellerMaxQualificationDeadlineAt!,
    );
    await fulfillment.processSellerMaxQualificationExpiration(expiredValue.order.id);
    expiredClock.mockRestore();
    const expired = await prisma.order.findUniqueOrThrow({ where: { id: expiredValue.order.id } });
    await expect(
      prisma.order.update({
        where: { id: expired.id },
        data: { sellerMaxQualificationStatus: 'QUALIFIED' },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.$executeRaw`UPDATE "Order" SET "sellerMaxQualificationDecidedAt" = "sellerMaxQualificationDecidedAt" + interval '1 millisecond' WHERE "id" = ${expired.id}::uuid`,
    ).rejects.toThrow();

    const pendingValue = await pendingMax();
    const pending = await prisma.order.findUniqueOrThrow({ where: { id: pendingValue.order.id } });
    await expect(
      prisma.order.update({
        where: { id: pending.id },
        data: { sellerMaxQualificationDecidedAt: new Date() },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.$executeRaw`UPDATE "Order" SET "sellerMaxQualificationStatus" = 'QUALIFIED', "sellerMaxQualificationDecidedAt" = clock_timestamp() WHERE "id" = ${pending.id}::uuid`,
    ).rejects.toThrow();
    await expect(
      prisma.$executeRaw`UPDATE "Order" SET "sellerMaxQualificationStatus" = 'QUALIFIED', "sellerMaxQualificationDecidedAt" = clock_timestamp(), "buyerConfirmedAt" = "sellerMaxQualificationDeadlineAt" + interval '1 millisecond' WHERE "id" = ${pending.id}::uuid`,
    ).rejects.toThrow();

    const standard = await activePaid();
    await expect(
      prisma.order.update({
        where: { id: standard.order.id },
        data: { sellerMaxQualificationVersion: 1 },
      }),
    ).rejects.toThrow();
  });

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
    const delivered = await prisma.orderDelivery.findUniqueOrThrow({
      where: { orderId: order.id },
    });
    await fulfillment.recordDelivered(input);
    expect(
      (await prisma.orderDelivery.findUniqueOrThrow({ where: { orderId: order.id } })).createdAt,
    ).toEqual(delivered.createdAt);
    await expect(
      prisma.orderDelivery.update({
        where: { id: delivered.id },
        data: { createdAt: new Date(0) },
      }),
    ).rejects.toBeDefined();
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

  it('overrides an explicitly supplied delivery timestamp at the database boundary', async () => {
    const { order, fixture } = await makeAwaiting();
    const clientTimestamp = new Date('2000-01-01T00:00:00.000Z');
    await prisma.orderDelivery.create({
      data: {
        orderId: order.id,
        sellerProfileId: fixture.seller.id,
        deliveryType: 'MANUAL_REFERENCE',
        evidenceHash: '9'.repeat(64),
        createdAt: clientTimestamp,
      },
    });
    const delivery = await prisma.orderDelivery.findUniqueOrThrow({ where: { orderId: order.id } });
    expect(delivery.createdAt).not.toEqual(clientTimestamp);
    expect(delivery.createdAt.getTime()).toBeGreaterThan(clientTimestamp.getTime());
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
