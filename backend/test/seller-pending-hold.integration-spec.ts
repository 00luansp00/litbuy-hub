import { randomUUID } from 'node:crypto';
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
import { calculateSellerMaxRelease } from '../src/financial/seller-max-release-calculator';
import { SellerHoldEligibilityService } from '../src/financial/seller-hold-eligibility.service';
import { SellerHeldFundsReleaseService } from '../src/financial/seller-held-funds-release.service';
import { SaleFinancialRecognitionService } from '../src/financial/sale-financial-recognition.service';
import { SellerPendingHoldService } from '../src/financial/seller-pending-hold.service';
import { PaidOrderActivationService } from '../src/orders/paid-order-activation.service';
import { OrderFulfillmentService } from '../src/orders/order-fulfillment.service';
import { commerceFixture, publishPlatformCommissionPolicy } from './order-checkout-test.helpers';

describe('SellerPendingHoldService with real PostgreSQL', () => {
  jest.setTimeout(120_000);
  let app: Awaited<ReturnType<ReturnType<typeof Test.createTestingModule>['compile']>>;
  let prisma: PrismaService;
  let cleanupPrisma: PrismaClient;
  let carts: CartsService;
  let checkout: CheckoutService;
  let activation: PaidOrderActivationService;
  let recognition: SaleFinancialRecognitionService;
  let service: SellerPendingHoldService;
  let eligibility: SellerHoldEligibilityService;
  let release: SellerHeldFundsReleaseService;
  let fulfillment: OrderFulfillmentService;
  let version = 50_000;

  beforeAll(async () => {
    cleanupPrisma = new PrismaClient();
    app = await Test.createTestingModule({ imports: [AppModule] }).compile();
    prisma = app.get(PrismaService);
    carts = app.get(CartsService);
    checkout = app.get(CheckoutService);
    activation = app.get(PaidOrderActivationService);
    recognition = app.get(SaleFinancialRecognitionService);
    service = app.get(SellerPendingHoldService);
    eligibility = app.get(SellerHoldEligibilityService);
    release = app.get(SellerHeldFundsReleaseService);
    fulfillment = app.get(OrderFulfillmentService);
  });
  beforeEach(() =>
    cleanupPrisma.$executeRawUnsafe('TRUNCATE TABLE "User", "CatalogCategory" CASCADE'),
  );
  afterAll(async () => {
    await app.close();
    await cleanupPrisma.$disconnect();
  });

  async function publishSellerReleasePolicy(
    actorUserId: string,
    delayHours: number,
    extraRule?: {
      code: string;
      delayHours: number;
      scope?: 'DEFAULT' | 'CATEGORY' | 'SUBCATEGORY';
      categoryId?: string;
      subcategoryId?: string;
    },
  ) {
    const active = await prisma.sellerReleasePolicyVersion.findFirst({
      where: { status: 'ACTIVE' },
      include: { rules: true },
    });
    if (
      active &&
      !extraRule &&
      active.rules.length === 1 &&
      active.rules[0].scope === 'DEFAULT' &&
      active.rules[0].delayHours === delayHours
    )
      return active;
    const draft = await prisma.sellerReleasePolicyVersion.create({
      data: {
        publicVersion: version++,
        effectiveFrom: new Date(Date.now() - 60_000),
        createdByUserId: actorUserId,
        rules: {
          create: [
            { code: 'DELIVERY_PROTECTION_DEFAULT', delayHours, enabled: true },
            ...(extraRule ? [{ ...extraRule, enabled: true }] : []),
          ],
        },
      },
      include: { rules: true },
    });
    return prisma.sellerReleasePolicyVersion.update({
      where: { id: draft.id },
      data: {
        status: 'ACTIVE',
        publishedByUserId: actorUserId,
        publishedAt: new Date(),
      },
      include: { rules: true },
    });
  }

  async function completedOrder(
    fee: bigint,
    releaseDelayHours = 72,
    releaseScope: 'DEFAULT' | 'CATEGORY' | 'SUBCATEGORY' = 'DEFAULT',
    confirmBuyer = true,
    publishCommission = true,
    sellerMax = false,
    deliveredAt?: Date,
    historicalTerminal?: 'QUALIFIED' | 'EXPIRED',
  ) {
    const fixture = await commerceFixture(prisma, 'NORMAL', undefined, 20, false, false);
    if (publishCommission) {
      await publishPlatformCommissionPolicy(prisma, fixture.sellerUser.id, {
        publicVersion: version++,
        percentBps: Number(fee),
      });
    }
    if (sellerMax) {
      await prisma.listingDraft.update({
        where: { id: fixture.draft.id },
        data: { requestedSellerPlan: 'LIT_MAX' },
      });
      await prisma.product.update({
        where: { id: fixture.product.id },
        data: { sellerPlan: 'LIT_MAX' },
      });
    }
    const subcategory =
      releaseScope === 'SUBCATEGORY'
        ? await prisma.catalogSubcategory.create({
            data: {
              categoryId: fixture.category.id,
              slug: `seller-hold-${randomUUID()}`,
              name: 'Seller hold test',
            },
          })
        : null;
    if (subcategory) {
      await prisma.listingDraft.update({
        where: { id: fixture.draft.id },
        data: { subcategoryId: subcategory.id },
      });
      await prisma.product.update({
        where: { id: fixture.product.id },
        data: { subcategoryId: subcategory.id },
      });
    }
    const releasePolicy = await publishSellerReleasePolicy(
      fixture.sellerUser.id,
      releaseScope === 'DEFAULT' ? releaseDelayHours : 72,
      releaseScope === 'DEFAULT'
        ? undefined
        : {
            code: `DELIVERY_PROTECTION_${releaseScope}`,
            delayHours: releaseDelayHours,
            scope: releaseScope,
            categoryId: releaseScope === 'CATEGORY' ? fixture.category.id : undefined,
            subcategoryId: releaseScope === 'SUBCATEGORY' ? subcategory!.id : undefined,
          },
    );
    const cart = await carts.add(fixture.buyer.id, fixture.seller.slug, {
      productId: fixture.product.id,
      quantity: 10,
      expectedVersion: 0,
    });
    const checkoutResult = await checkout.create(
      fixture.buyer.id,
      parseIdempotencyKey(`seller-hold:${randomUUID()}`),
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
    await recognition.processOne(order.id);
    await fulfillment.makeAvailable(order.id);
    if (deliveredAt) {
      // The financial clock requires a possible history: Order <= paid Payment <= delivery <= DB now.
      await prisma.order.update({
        where: { id: order.id },
        data: { createdAt: new Date(deliveredAt.getTime() - 2 * 3_600_000) },
      });
      await prisma.payment.update({
        where: { id: payment.id },
        data: { paidAt: new Date(deliveredAt.getTime() - 3_600_000) },
      });
      const delivery = await seedHistoricalPreGuardDelivery(order, deliveredAt);
      const k = calculateSellerMaxRelease({
        deliveredAt: delivery.createdAt,
        frozenBaseReleaseDelayHours: releaseDelayHours,
      });
      const confirmedAt = new Date(delivery.createdAt.getTime() + 3_600_000);
      const baseAt = k.baseReleaseEligibleAt;
      await prisma.order.update({
        where: { id: order.id },
        data: {
          fulfillmentStatus:
            historicalTerminal === 'QUALIFIED' ? 'CONFIRMED' : 'AWAITING_BUYER_CONFIRMATION',
          ...(historicalTerminal === 'QUALIFIED' ? { status: 'COMPLETED' as const } : {}),
          sellerMaxQualificationVersion: 1,
          sellerMaxQualificationStatus: historicalTerminal ?? 'PENDING',
          sellerMaxQualificationDeadlineAt: new Date(delivery.createdAt.getTime() + 48 * 3_600_000),
          sellerMaxQualificationDecidedAt: historicalTerminal
            ? historicalTerminal === 'QUALIFIED'
              ? confirmedAt
              : new Date(delivery.createdAt.getTime() + 48 * 3_600_000 + 1)
            : null,
          buyerConfirmedAt: historicalTerminal === 'QUALIFIED' ? confirmedAt : null,
          sellerMaxReleaseCalculationVersion: 1,
          sellerMaxReleaseReductionHours: k.reductionHours,
          sellerMaxReleaseTargetAt: k.maxTargetAt,
          sellerMaxEffectiveReleaseAt:
            historicalTerminal === 'QUALIFIED'
              ? k.effectiveReleaseAt
              : historicalTerminal === 'EXPIRED'
                ? baseAt
                : null,
          version: { increment: 1 },
        },
      });
    } else {
      await fulfillment.recordDelivered({
        orderCode: order.publicCode,
        actorUserId: fixture.sellerUser.id,
        deliveryType: 'MANUAL_REFERENCE',
        evidenceHash: 'a'.repeat(64),
      });
    }
    const delivery = await prisma.orderDelivery.findUniqueOrThrow({
      where: { orderId: order.id },
    });
    if (confirmBuyer) await fulfillment.confirmReceipt(order.publicCode, fixture.buyer.id);
    return {
      order: await prisma.order.findUniqueOrThrow({ where: { id: order.id } }),
      payment,
      actorUserId: fixture.sellerUser.id,
      releasePolicy,
      subcategory,
      delivery,
    };
  }

  async function databaseNow() {
    const [{ now }] = await prisma.$queryRaw<Array<{ now: Date }>>`
      SELECT transaction_timestamp()::timestamp(3) AS "now"
    `;
    return now;
  }

  async function seedHistoricalPreGuardDelivery(
    order: { id: string; sellerProfileId: string },
    deliveredAt: Date,
  ) {
    expect(await prisma.orderDelivery.count({ where: { orderId: order.id } })).toBe(0);
    // G3 deliberately rewrites timestamps on new deliveries. This narrow test-only seed models a
    // row that already existed before the guard, then restores the production guard before J/K.
    try {
      await prisma.$executeRawUnsafe(
        'ALTER TABLE "OrderDelivery" DISABLE TRIGGER "OrderDelivery_createdAt_guard"',
      );
      await prisma.orderDelivery.create({
        data: {
          orderId: order.id,
          sellerProfileId: order.sellerProfileId,
          deliveryType: 'MANUAL_REFERENCE',
          evidenceHash: 'a'.repeat(64),
          createdAt: deliveredAt,
        },
      });
    } finally {
      await prisma.$executeRawUnsafe(
        'ALTER TABLE "OrderDelivery" ENABLE TRIGGER "OrderDelivery_createdAt_guard"',
      );
    }
    const triggers = await prisma.$queryRaw<Array<{ tgname: string; tgenabled: string }>>`
      SELECT tgname, tgenabled FROM pg_trigger
      WHERE tgname IN (
        'OrderDelivery_createdAt_guard',
        'Order_seller_max_qualification_invariants',
        'Order_seller_max_release_invariants'
      ) ORDER BY tgname
    `;
    expect(triggers).toEqual([
      { tgname: 'OrderDelivery_createdAt_guard', tgenabled: 'O' },
      { tgname: 'Order_seller_max_qualification_invariants', tgenabled: 'O' },
      { tgname: 'Order_seller_max_release_invariants', tgenabled: 'O' },
    ]);
    const persisted = await prisma.orderDelivery.findUniqueOrThrow({
      where: { orderId: order.id },
    });
    expect(persisted.createdAt).toEqual(deliveredAt);
    const [historicalOrder, historicalPayment, now] = await Promise.all([
      prisma.order.findUniqueOrThrow({ where: { id: order.id } }),
      prisma.payment.findUniqueOrThrow({ where: { orderId: order.id } }),
      databaseNow(),
    ]);
    expect(historicalOrder.createdAt.getTime()).toBeLessThanOrEqual(
      historicalPayment.paidAt!.getTime(),
    );
    expect(historicalPayment.paidAt!.getTime()).toBeLessThanOrEqual(persisted.createdAt.getTime());
    expect(persisted.createdAt.getTime()).toBeLessThanOrEqual(now.getTime());
    return persisted;
  }

  async function historicalQualifiedMax(hoursBeforeNow: 119 | 121) {
    const now = await databaseNow();
    const deliveredAt = new Date(now.getTime() - hoursBeforeNow * 3_600_000);
    const result = await completedOrder(
      1000n,
      168,
      'DEFAULT',
      false,
      true,
      true,
      deliveredAt,
      'QUALIFIED',
    );
    const target = new Date(result.delivery.createdAt.getTime() + 120 * 3_600_000);
    return { ...result, target, seededAt: now };
  }

  async function materializeExpectedHold(orderId: string) {
    expect(await service.processOne(orderId)).toBe('PROCESSED');
    expect(
      await prisma.reconciliationIssue.count({
        where: { referenceType: 'SellerPendingHold', referenceId: orderId },
      }),
    ).toBe(0);
    const hold = await prisma.financialHold.findFirst({ where: { orderId } });
    expect(hold).not.toBeNull();
    return hold!;
  }

  it('releases MAX at five days while preserving the seven-day base and replays once', async () => {
    const { order, delivery, target } = await historicalQualifiedMax(121);
    const hold = await materializeExpectedHold(order.id);
    expect(hold.releaseEligibleAt).toEqual(
      new Date(delivery.createdAt.getTime() + 168 * 3_600_000),
    );
    const beforeEligibility = await databaseNow();
    expect(beforeEligibility.getTime()).toBeGreaterThanOrEqual(target.getTime());
    expect(beforeEligibility.getTime()).toBeLessThan(hold.releaseEligibleAt!.getTime());
    expect(await eligibility.processOne(hold.id)).toBe('RELEASE_ELIGIBLE');
    expect(await release.processOne(hold.id)).toBe('RELEASED');
    const first = await prisma.financialHold.findUniqueOrThrow({ where: { id: hold.id } });
    expect(first.releasedAt!.getTime()).toBeGreaterThanOrEqual(target.getTime());
    expect(first.releasedAt!.getTime()).toBeLessThan(first.releaseEligibleAt!.getTime());
    expect(await release.processOne(hold.id)).toBe('ALREADY_RELEASED');
    const replay = await prisma.financialHold.findUniqueOrThrow({ where: { id: hold.id } });
    expect(replay).toMatchObject({
      releasedAt: first.releasedAt,
      releaseLedgerTransactionId: first.releaseLedgerTransactionId,
      releaseEligibleAt: hold.releaseEligibleAt,
    });
    const postings = await prisma.ledgerTransaction.findMany({
      where: { type: 'SELLER_FUNDS_RELEASED', referenceId: hold.id },
      include: { entries: { include: { account: true } } },
    });
    expect(postings).toHaveLength(1);
    expect(postings[0]).toMatchObject({ currency: hold.currency });
    expect(postings[0].entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          direction: 'DEBIT',
          amountMinor: hold.amountMinor,
          account: expect.objectContaining({
            ownerId: hold.sellerProfileId,
            purpose: 'SELLER_HELD',
          }),
        }),
        expect.objectContaining({
          direction: 'CREDIT',
          amountMinor: hold.amountMinor,
          account: expect.objectContaining({
            ownerId: hold.sellerProfileId,
            purpose: 'SELLER_AVAILABLE',
          }),
        }),
      ]),
    );
  });

  it('G2 rejects a prematurely promoted MAX hold', async () => {
    const premature = await historicalQualifiedMax(119);
    const earlyHold = await materializeExpectedHold(premature.order.id);
    expect(await eligibility.processOne(earlyHold.id)).toBe('NOT_DUE');
    await prisma.financialHold.update({
      where: { id: earlyHold.id },
      data: { status: 'RELEASE_ELIGIBLE' },
    });
    expect(await release.processOne(earlyHold.id)).toBe('RECONCILIATION_REQUIRED');
    expect(
      await prisma.ledgerTransaction.count({
        where: { type: 'SELLER_FUNDS_RELEASED', referenceId: earlyHold.id },
      }),
    ).toBe(0);
  });

  it('keeps a due MAX hold blocked by dispute', async () => {
    const blocked = await historicalQualifiedMax(121);
    const blockedHold = await materializeExpectedHold(blocked.order.id);
    expect(await eligibility.processOne(blockedHold.id)).toBe('RELEASE_ELIGIBLE');
    await prisma.order.update({ where: { id: blocked.order.id }, data: { disputeStatus: 'OPEN' } });
    expect(await release.processOne(blockedHold.id)).toBe('BUSINESS_BLOCKED');
    expect(
      await prisma.ledgerTransaction.count({
        where: { type: 'SELLER_FUNDS_RELEASED', referenceId: blockedHold.id },
      }),
    ).toBe(0);
  });

  it('keeps EXPIRED MAX not due at its five-day target after late confirmation', async () => {
    const deliveredAt = new Date((await databaseNow()).getTime() - 121 * 3_600_000);
    const future = await completedOrder(
      1000n,
      168,
      'DEFAULT',
      false,
      true,
      true,
      deliveredAt,
      'EXPIRED',
    );
    const futureHold = await materializeExpectedHold(future.order.id);
    expect(await eligibility.processOne(futureHold.id)).toBe('NOT_DUE');
    await fulfillment.confirmReceipt(future.order.publicCode, future.order.buyerUserId);
    expect(await prisma.order.findUniqueOrThrow({ where: { id: future.order.id } })).toMatchObject({
      sellerMaxQualificationStatus: 'EXPIRED',
      sellerMaxEffectiveReleaseAt: futureHold.releaseEligibleAt,
    });
  });

  it('makes EXPIRED MAX eligible only at its seven-day base', async () => {
    const due = await completedOrder(
      1000n,
      168,
      'DEFAULT',
      false,
      true,
      true,
      new Date((await databaseNow()).getTime() - 169 * 3_600_000),
      'EXPIRED',
    );
    const dueBase = new Date(due.delivery.createdAt.getTime() + 168 * 3_600_000);
    const dueHold = await materializeExpectedHold(due.order.id);
    expect(dueHold.releaseEligibleAt).toEqual(dueBase);
    expect(await eligibility.processOne(dueHold.id)).toBe('RELEASE_ELIGIBLE');
  });

  it.each([
    [96, 0, 96],
    [168, 48, 120],
    [336, 96, 240],
    [504, 144, 360],
  ])(
    'persists K v1 for %dh while the monetary hold retains its base deadline',
    async (delayHours, reductionHours, targetHours) => {
      const { order, delivery } = await completedOrder(
        1000n,
        delayHours,
        'DEFAULT',
        false,
        true,
        true,
      );
      expect(await service.processOne(order.id)).toBe('PROCESSED');
      const [snapshot, hold] = await Promise.all([
        prisma.order.findUniqueOrThrow({ where: { id: order.id } }),
        prisma.financialHold.findFirstOrThrow({ where: { orderId: order.id } }),
      ]);
      expect(snapshot).toMatchObject({
        sellerPlanSnapshot: 'LIT_MAX',
        sellerMaxQualificationStatus: 'PENDING',
        sellerMaxReleaseCalculationVersion: 1,
        sellerMaxReleaseReductionHours: reductionHours,
        sellerMaxEffectiveReleaseAt: null,
      });
      expect(snapshot.sellerMaxReleaseTargetAt).toEqual(
        new Date(delivery.createdAt.getTime() + targetHours * 3_600_000),
      );
      expect(hold.releaseEligibleAt).toEqual(
        new Date(delivery.createdAt.getTime() + delayHours * 3_600_000),
      );
      expect(await eligibility.processOne(hold.id)).toBe('NOT_DUE');
      expect(await prisma.reconciliationIssue.count({ where: { referenceId: hold.id } })).toBe(0);
    },
  );

  it('qualifies K after a hold exists and PostgreSQL rejects rerating K or its base hold', async () => {
    const { order, delivery } = await completedOrder(1000n, 168, 'DEFAULT', false, true, true);
    expect(await service.processOne(order.id)).toBe('PROCESSED');
    const hold = await prisma.financialHold.findFirstOrThrow({ where: { orderId: order.id } });
    await fulfillment.confirmReceipt(order.publicCode, order.buyerUserId);
    const qualified = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(qualified.sellerMaxQualificationStatus).toBe('QUALIFIED');
    expect(qualified.sellerMaxEffectiveReleaseAt).toEqual(
      new Date(delivery.createdAt.getTime() + 120 * 3_600_000),
    );
    expect(hold.releaseEligibleAt).toEqual(
      new Date(delivery.createdAt.getTime() + 168 * 3_600_000),
    );
    await expect(
      prisma.order.update({
        where: { id: order.id },
        data: { sellerMaxReleaseReductionHours: 96 },
      }),
    ).rejects.toBeDefined();
    await expect(
      prisma.financialHold.update({
        where: { id: hold.id },
        data: { releaseEligibleAt: qualified.sellerMaxEffectiveReleaseAt },
      }),
    ).rejects.toBeDefined();
    expect(
      (await prisma.financialHold.findUniqueOrThrow({ where: { id: hold.id } })).releaseEligibleAt,
    ).toEqual(hold.releaseEligibleAt);
  });

  it('qualifies K before hold materialization without changing the base deadline', async () => {
    const { order, delivery } = await completedOrder(1000n, 168, 'DEFAULT', true, true, true);
    const qualified = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(qualified.sellerMaxQualificationStatus).toBe('QUALIFIED');
    expect(await service.processOne(order.id)).toBe('PROCESSED');
    const hold = await prisma.financialHold.findFirstOrThrow({ where: { orderId: order.id } });
    expect(qualified.sellerMaxEffectiveReleaseAt).toEqual(
      new Date(delivery.createdAt.getTime() + 120 * 3_600_000),
    );
    expect(hold.releaseEligibleAt).toEqual(
      new Date(delivery.createdAt.getTime() + 168 * 3_600_000),
    );
  });

  it('materializes and makes a due hold eligible while the buyer remains inactive', async () => {
    const { order, delivery } = await completedOrder(1000n, 0, 'DEFAULT', false);
    expect(order.status).toBe('ACTIVE');
    expect(order.fulfillmentStatus).toBe('AWAITING_BUYER_CONFIRMATION');

    expect(await service.processOne(order.id)).toBe('PROCESSED');
    const hold = await prisma.financialHold.findFirstOrThrow({ where: { orderId: order.id } });
    expect(hold.releasePolicyAppliedAt).toEqual(delivery.createdAt);
    expect(hold.releaseEligibleAt).toEqual(delivery.createdAt);
    expect(await eligibility.processOne(hold.id)).toBe('RELEASE_ELIGIBLE');
    expect(await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).toMatchObject({
      status: 'ACTIVE',
      fulfillmentStatus: 'AWAITING_BUYER_CONFIRMATION',
    });
    expect(await eligibility.processOne(hold.id)).toBe('ALREADY_ELIGIBLE');
  });

  it('materializes only the zero-proceeds marker after delivery without buyer confirmation', async () => {
    const { order } = await completedOrder(10_000n, 0, 'DEFAULT', false);
    expect(await service.processOne(order.id)).toBe('PROCESSED');
    expect(await prisma.sellerPendingHoldZero.count({ where: { orderId: order.id } })).toBe(1);
    expect(await prisma.financialHold.count({ where: { orderId: order.id } })).toBe(0);
    expect(
      await prisma.ledgerTransaction.count({
        where: { type: 'SELLER_FUNDS_HELD', referenceId: order.id },
      }),
    ).toBe(0);
  });

  it('treats pre-delivery processing as not yet a candidate without reconciliation', async () => {
    const { order } = await completedOrder(1000n);
    await prisma.financialHold.deleteMany({ where: { orderId: order.id } });
    await prisma.ledgerTransaction.deleteMany({
      where: { type: 'SELLER_FUNDS_HELD', referenceId: order.id },
    });
    await prisma.orderDelivery.delete({ where: { orderId: order.id } });
    await prisma.order.update({
      where: { id: order.id },
      data: { status: 'ACTIVE', fulfillmentStatus: 'AWAITING_SELLER' },
    });
    expect(await service.processOne(order.id)).toBe('ALREADY_HANDLED');
    expect(
      await prisma.reconciliationIssue.count({
        where: { referenceType: 'SellerPendingHold', referenceId: order.id },
      }),
    ).toBe(0);
  });

  it.each(['OPEN', 'UNDER_REVIEW'] as const)(
    'creates protection during %s and blocks eligibility',
    async (disputeStatus) => {
      const { order } = await completedOrder(1000n, 0, 'DEFAULT', false);
      await prisma.order.update({ where: { id: order.id }, data: { disputeStatus } });
      expect(await service.processOne(order.id)).toBe('PROCESSED');
      const hold = await prisma.financialHold.findFirstOrThrow({ where: { orderId: order.id } });
      expect(await eligibility.processOne(hold.id)).toBe('BUSINESS_BLOCKED');
      expect(
        (await prisma.financialHold.findUniqueOrThrow({ where: { id: hold.id } })).status,
      ).toBe('ACTIVE');
      expect(
        await prisma.ledgerTransaction.count({
          where: { type: 'SELLER_FUNDS_HELD', referenceId: order.id },
        }),
      ).toBe(1);
      expect(
        await prisma.financialHold.count({
          where: { orderId: order.id, reason: 'DELIVERY_PROTECTION' },
        }),
      ).toBe(1);
      expect(
        await prisma.reconciliationIssue.count({
          where: { referenceType: 'SellerPendingHold', referenceId: order.id },
        }),
      ).toBe(0);
    },
  );

  it.each(['RESOLVED_BUYER', 'CLOSED'] as const)(
    'conservatively blocks due eligibility for %s',
    async (disputeStatus) => {
      const { order } = await completedOrder(1000n, 0, 'DEFAULT', false);
      expect(await service.processOne(order.id)).toBe('PROCESSED');
      const hold = await prisma.financialHold.findFirstOrThrow({ where: { orderId: order.id } });
      await prisma.order.update({ where: { id: order.id }, data: { disputeStatus } });
      expect(await eligibility.processOne(hold.id)).toBe('BUSINESS_BLOCKED');
    },
  );

  it('keeps the original deadline when seller resolution happens before due', async () => {
    const future = await completedOrder(1000n, 72, 'DEFAULT', false);
    expect(await service.processOne(future.order.id)).toBe('PROCESSED');
    const futureHold = await prisma.financialHold.findFirstOrThrow({
      where: { orderId: future.order.id },
    });
    await prisma.order.update({
      where: { id: future.order.id },
      data: { disputeStatus: 'RESOLVED_SELLER' },
    });
    expect(await eligibility.processOne(futureHold.id)).toBe('NOT_DUE');
    expect(
      await prisma.financialHold.findUniqueOrThrow({ where: { id: futureHold.id } }),
    ).toMatchObject({
      status: 'ACTIVE',
      releasePolicyAppliedAt: future.delivery.createdAt,
      releaseEligibleAt: new Date(future.delivery.createdAt.getTime() + 72 * 3_600_000),
    });
    expect(
      await prisma.ledgerTransaction.count({
        where: { type: 'SELLER_FUNDS_RELEASED', referenceId: futureHold.id },
      }),
    ).toBe(0);
  });

  it('makes seller resolution immediately eligible after the original deadline', async () => {
    const due = await completedOrder(1000n, 0, 'DEFAULT', false);
    expect(await service.processOne(due.order.id)).toBe('PROCESSED');
    const dueHold = await prisma.financialHold.findFirstOrThrow({
      where: { orderId: due.order.id },
    });
    await prisma.order.update({
      where: { id: due.order.id },
      data: { disputeStatus: 'RESOLVED_SELLER' },
    });
    expect(await eligibility.processOne(dueHold.id)).toBe('RELEASE_ELIGIBLE');
    expect(
      await prisma.financialHold.findUniqueOrThrow({ where: { id: dueHold.id } }),
    ).toMatchObject({
      releasePolicyAppliedAt: due.delivery.createdAt,
      releaseEligibleAt: due.delivery.createdAt,
    });
  });

  it('releases due proceeds while the buyer remains inactive without changing the Order', async () => {
    const { order } = await completedOrder(1000n, 0, 'DEFAULT', false);
    await service.processOne(order.id);
    const hold = await prisma.financialHold.findFirstOrThrow({ where: { orderId: order.id } });
    await eligibility.processOne(hold.id);
    expect(
      await app.get(FinancialLedgerService).getSellerFinancialBalance(order.sellerProfileId),
    ).toMatchObject({ held: 9000n, available: 0n });
    expect(await release.processOne(hold.id)).toBe('RELEASED');
    expect(await release.processOne(hold.id)).toBe('ALREADY_RELEASED');
    expect(await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).toMatchObject({
      status: 'ACTIVE',
      paymentStatus: 'PAID',
      fulfillmentStatus: 'AWAITING_BUYER_CONFIRMATION',
    });
    expect(await prisma.financialHold.findUniqueOrThrow({ where: { id: hold.id } })).toMatchObject({
      status: 'RELEASED',
      releaseLedgerTransactionId: expect.any(String),
      releasedAt: expect.any(Date),
    });
    expect(
      await app.get(FinancialLedgerService).getSellerFinancialBalance(order.sellerProfileId),
    ).toMatchObject({ held: 0n, available: 9000n });
    expect(
      await prisma.ledgerTransaction.count({
        where: { type: 'SELLER_FUNDS_RELEASED', referenceId: hold.id },
      }),
    ).toBe(1);
    expect(
      await prisma.reconciliationIssue.count({
        where: { referenceType: 'SellerHeldFundsRelease', referenceId: hold.id },
      }),
    ).toBe(0);
  });

  it('moves the snapshot proceeds from pending to held without available or reserved entries', async () => {
    const { order, payment, actorUserId, delivery } = await completedOrder(1000n);
    const policy = await publishSellerReleasePolicy(actorUserId, 72);
    const rule = policy.rules[0];
    expect(await service.processOne(order.id)).toBe('PROCESSED');
    const posting = await prisma.ledgerTransaction.findFirstOrThrow({
      where: { type: 'SELLER_FUNDS_HELD', referenceType: 'OrderSellerHold', referenceId: order.id },
      include: {
        entries: { include: { account: true } },
        financialEvent: { include: { outbox: true } },
      },
    });
    expect(posting.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          direction: 'DEBIT',
          amountMinor: 9000n,
          account: expect.objectContaining({ purpose: 'SELLER_PENDING' }),
        }),
        expect.objectContaining({
          direction: 'CREDIT',
          amountMinor: 9000n,
          account: expect.objectContaining({ purpose: 'SELLER_HELD' }),
        }),
      ]),
    );
    expect(posting.financialEvent?.outbox).not.toBeNull();
    expect(
      posting.entries.some((entry) =>
        ['SELLER_AVAILABLE', 'SELLER_RESERVED'].includes(entry.account.purpose),
      ),
    ).toBe(false);
    const hold = await prisma.financialHold.findFirstOrThrow({
      where: { orderId: order.id, reason: 'DELIVERY_PROTECTION' },
    });
    expect(hold).toMatchObject({
      paymentId: payment.id,
      amountMinor: 9000n,
      status: 'ACTIVE',
      releasedAt: null,
      sellerReleasePolicyVersionId: policy.id,
      sellerReleasePolicyRuleId: rule.id,
      releaseDelayHours: 72,
      releasePolicyAppliedAt: expect.any(Date),
      releaseEligibleAt: expect.any(Date),
    });
    expect(hold.releaseEligibleAt!.getTime()).toBe(delivery.createdAt.getTime() + 72 * 3_600_000);
    expect(hold.releasePolicyAppliedAt).toEqual(delivery.createdAt);
    expect(await prisma.settlement.count()).toBe(0);
    expect(await prisma.withdrawal.count()).toBe(0);
  });

  it('is idempotent under six concurrent workers and emits once', async () => {
    const { order, actorUserId } = await completedOrder(0n);
    await publishSellerReleasePolicy(actorUserId, 72);
    await Promise.all(Array.from({ length: 6 }, () => service.processOne(order.id)));
    expect(
      await prisma.ledgerTransaction.count({
        where: { type: 'SELLER_FUNDS_HELD', referenceId: order.id },
      }),
    ).toBe(1);
    expect(await prisma.financialHold.count({ where: { orderId: order.id } })).toBe(1);
    expect(
      await prisma.financialEvent.count({
        where: { type: 'SELLER_FUNDS_HELD', aggregateId: order.id },
      }),
    ).toBe(1);
    expect(
      await prisma.financialOutboxEvent.count({ where: { eventType: 'SELLER_FUNDS_HELD' } }),
    ).toBe(1);
  });

  it('fails closed without an authoritative delivery and creates no hold posting', async () => {
    const { order } = await completedOrder(1000n);
    await prisma.orderDelivery.delete({ where: { orderId: order.id } });

    expect(await service.processOne(order.id)).toBe('PROCESSED');
    expect(
      await prisma.ledgerTransaction.count({
        where: { type: 'SELLER_FUNDS_HELD', referenceId: order.id },
      }),
    ).toBe(0);
    expect(await prisma.financialHold.count({ where: { orderId: order.id } })).toBe(0);
    expect(
      await prisma.reconciliationIssue.findFirstOrThrow({
        where: { referenceType: 'SellerPendingHold', referenceId: order.id },
      }),
    ).toMatchObject({ details: { errorCode: 'DELIVERY_RECORD_MISSING' } });
  });

  it('fails closed without an effective policy and does not move pending funds', async () => {
    const { order, releasePolicy } = await completedOrder(1000n);
    // Represents an Order persisted before the checkout snapshot migration.
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "Order" DISABLE TRIGGER "Order_release_policy_snapshot_guard"',
    );
    try {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          sellerReleasePolicyVersionId: null,
          sellerReleasePolicyRuleId: null,
          sellerReleasePolicySource: null,
          sellerReleasePolicyCategoryId: null,
          sellerReleasePolicySubcategoryId: null,
          frozenBaseReleaseDelayHours: null,
        },
      });
    } finally {
      await prisma.$executeRawUnsafe(
        'ALTER TABLE "Order" ENABLE TRIGGER "Order_release_policy_snapshot_guard"',
      );
    }
    await prisma.sellerReleasePolicyVersion.update({
      where: { id: releasePolicy.id },
      data: { status: 'RETIRED' },
    });
    await Promise.all(Array.from({ length: 6 }, () => service.processOne(order.id)));
    expect(
      await prisma.ledgerTransaction.count({
        where: { type: 'SELLER_FUNDS_HELD', referenceId: order.id },
      }),
    ).toBe(0);
    expect(await prisma.financialHold.count({ where: { orderId: order.id } })).toBe(0);
    expect(
      await prisma.reconciliationIssue.findMany({
        where: { referenceType: 'SellerPendingHold', referenceId: order.id, status: 'OPEN' },
      }),
    ).toEqual([
      expect.objectContaining({
        details: { errorCode: 'SELLER_RELEASE_POLICY_NOT_FOUND' },
      }),
    ]);
  });

  it('rejects an ambiguous DEFAULT rule set in PostgreSQL without partial artifacts', async () => {
    const { order, actorUserId } = await completedOrder(1000n);
    await expect(
      publishSellerReleasePolicy(actorUserId, 72, {
        code: 'UNEXPECTED_ENABLED',
        delayHours: 1,
      }),
    ).rejects.toBeDefined();
    expect(
      await prisma.ledgerTransaction.count({
        where: { type: 'SELLER_FUNDS_HELD', referenceId: order.id },
      }),
    ).toBe(0);
    expect(await prisma.financialHold.count({ where: { orderId: order.id } })).toBe(0);
    expect(await prisma.reconciliationIssue.count({ where: { referenceId: order.id } })).toBe(0);
  });

  it('keeps delay zero scheduled and ACTIVE without releasing funds', async () => {
    const { order, payment, actorUserId } = await completedOrder(1000n, 0);
    await publishSellerReleasePolicy(actorUserId, 0);
    expect(await service.processOne(order.id)).toBe('PROCESSED');
    const hold = await prisma.financialHold.findFirstOrThrow({ where: { orderId: order.id } });
    expect(hold.releaseEligibleAt).toEqual(hold.releasePolicyAppliedAt);
    expect(hold.status).toBe('ACTIVE');
    expect(hold.releasedAt).toBeNull();
    const before = {
      ledgerTransactions: await prisma.ledgerTransaction.count(),
      ledgerEntries: await prisma.ledgerEntry.count(),
      balances: await prisma.$queryRaw<Array<{ purpose: string; balance: bigint }>>`
        SELECT a."purpose"::text AS "purpose",
          COALESCE(SUM(CASE e."direction" WHEN 'CREDIT' THEN e."amountMinor" ELSE -e."amountMinor" END), 0)::bigint AS "balance"
        FROM "LedgerAccount" a LEFT JOIN "LedgerEntry" e ON e."accountId" = a."id"
        WHERE a."ownerType" = 'SELLER' AND a."ownerId" = ${order.sellerProfileId}
          AND a."purpose" IN ('SELLER_HELD', 'SELLER_AVAILABLE', 'SELLER_RESERVED')
        GROUP BY a."purpose" ORDER BY a."purpose"
      `,
      order: await prisma.order.findUniqueOrThrow({ where: { id: order.id } }),
      payment: await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } }),
      delivery: await prisma.orderDelivery.findUniqueOrThrow({ where: { orderId: order.id } }),
    };
    expect(await eligibility.processOne(hold.id)).toBe('RELEASE_ELIGIBLE');
    expect(await eligibility.processOne(hold.id)).toBe('ALREADY_ELIGIBLE');
    expect(await prisma.financialHold.findUniqueOrThrow({ where: { id: hold.id } })).toMatchObject({
      status: 'RELEASE_ELIGIBLE',
      releasedAt: null,
    });
    expect(await prisma.ledgerTransaction.count()).toBe(before.ledgerTransactions);
    expect(await prisma.ledgerEntry.count()).toBe(before.ledgerEntries);
    expect(
      await prisma.$queryRaw<Array<{ purpose: string; balance: bigint }>>`
        SELECT a."purpose"::text AS "purpose",
          COALESCE(SUM(CASE e."direction" WHEN 'CREDIT' THEN e."amountMinor" ELSE -e."amountMinor" END), 0)::bigint AS "balance"
        FROM "LedgerAccount" a LEFT JOIN "LedgerEntry" e ON e."accountId" = a."id"
        WHERE a."ownerType" = 'SELLER' AND a."ownerId" = ${order.sellerProfileId}
          AND a."purpose" IN ('SELLER_HELD', 'SELLER_AVAILABLE', 'SELLER_RESERVED')
        GROUP BY a."purpose" ORDER BY a."purpose"
      `,
    ).toEqual(before.balances);
    expect(await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).toEqual(before.order);
    expect(await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).toEqual(
      before.payment,
    );
    expect(await prisma.orderDelivery.findUniqueOrThrow({ where: { orderId: order.id } })).toEqual(
      before.delivery,
    );
  });

  it.each(['CATEGORY', 'SUBCATEGORY'] as const)(
    'bridges a retired %s checkout snapshot through hold, eligibility, and release',
    async (scope) => {
      const { order, actorUserId, releasePolicy, delivery } = await completedOrder(1000n, 0, scope);
      const selectedRule = releasePolicy.rules.find((rule) => rule.scope === scope)!;
      expect(order).toMatchObject({
        sellerReleasePolicyVersionId: releasePolicy.id,
        sellerReleasePolicyRuleId: selectedRule.id,
        sellerReleasePolicySource: scope,
        frozenBaseReleaseDelayHours: 0,
      });
      await prisma.sellerReleasePolicyVersion.update({
        where: { id: releasePolicy.id },
        data: { status: 'RETIRED' },
      });
      const replacement = await publishSellerReleasePolicy(actorUserId, 168);

      expect(await service.processOne(order.id)).toBe('PROCESSED');
      const hold = await prisma.financialHold.findFirstOrThrow({ where: { orderId: order.id } });
      expect(hold).toMatchObject({
        sellerReleasePolicyVersionId: releasePolicy.id,
        sellerReleasePolicyRuleId: selectedRule.id,
        releaseDelayHours: 0,
        releasePolicyAppliedAt: delivery.createdAt,
        releaseEligibleAt: delivery.createdAt,
      });
      expect(hold.sellerReleasePolicyVersionId).not.toBe(replacement.id);
      expect(await eligibility.processOne(hold.id)).toBe('RELEASE_ELIGIBLE');
      expect(await release.processOne(hold.id)).toBe('RELEASED');
    },
  );

  it('uses the frozen PostgreSQL deadline and leaves a future hold ACTIVE', async () => {
    const { order, actorUserId } = await completedOrder(1000n);
    await publishSellerReleasePolicy(actorUserId, 72);
    await service.processOne(order.id);
    const hold = await prisma.financialHold.findFirstOrThrow({ where: { orderId: order.id } });
    expect(await eligibility.processOne(hold.id)).toBe('NOT_DUE');
    expect((await prisma.financialHold.findUniqueOrThrow({ where: { id: hold.id } })).status).toBe(
      'ACTIVE',
    );
    expect(
      await prisma.reconciliationIssue.count({
        where: { referenceType: 'SellerHoldEligibility', referenceId: hold.id },
      }),
    ).toBe(0);
  });

  it('reconciles a structurally valid RELEASE_ELIGIBLE hold marked before its deadline', async () => {
    const { order, payment, actorUserId } = await completedOrder(1000n);
    await publishSellerReleasePolicy(actorUserId, 72);
    await service.processOne(order.id);
    const hold = await prisma.financialHold.findFirstOrThrow({ where: { orderId: order.id } });
    expect(hold.status).toBe('ACTIVE');
    const before = {
      ledgerTransactions: await prisma.ledgerTransaction.count(),
      ledgerEntries: await prisma.ledgerEntry.count(),
      balances: await prisma.$queryRaw<Array<{ purpose: string; balance: bigint }>>`
        SELECT a."purpose"::text AS "purpose",
          COALESCE(SUM(CASE e."direction" WHEN 'CREDIT' THEN e."amountMinor" ELSE -e."amountMinor" END), 0)::bigint AS "balance"
        FROM "LedgerAccount" a LEFT JOIN "LedgerEntry" e ON e."accountId" = a."id"
        WHERE a."ownerType" = 'SELLER' AND a."ownerId" = ${order.sellerProfileId}
          AND a."purpose" IN ('SELLER_HELD', 'SELLER_AVAILABLE', 'SELLER_RESERVED')
        GROUP BY a."purpose" ORDER BY a."purpose"
      `,
      order: await prisma.order.findUniqueOrThrow({ where: { id: order.id } }),
      payment: await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } }),
      delivery: await prisma.orderDelivery.findUniqueOrThrow({ where: { orderId: order.id } }),
    };

    await prisma.financialHold.update({
      where: { id: hold.id },
      data: { status: 'RELEASE_ELIGIBLE' },
    });
    expect(await eligibility.processOne(hold.id)).toBe('RECONCILIATION_REQUIRED');
    expect(
      await prisma.reconciliationIssue.findFirst({
        where: { referenceType: 'SellerHoldEligibility', referenceId: hold.id, status: 'OPEN' },
      }),
    ).toMatchObject({ details: { errorCode: 'SELLER_HOLD_ELIGIBILITY_PREMATURE' } });
    expect(await prisma.financialHold.findUniqueOrThrow({ where: { id: hold.id } })).toMatchObject({
      status: 'RELEASE_ELIGIBLE',
      releasedAt: null,
    });
    expect(await prisma.ledgerTransaction.count()).toBe(before.ledgerTransactions);
    expect(await prisma.ledgerEntry.count()).toBe(before.ledgerEntries);
    expect(
      await prisma.$queryRaw<Array<{ purpose: string; balance: bigint }>>`
        SELECT a."purpose"::text AS "purpose",
          COALESCE(SUM(CASE e."direction" WHEN 'CREDIT' THEN e."amountMinor" ELSE -e."amountMinor" END), 0)::bigint AS "balance"
        FROM "LedgerAccount" a LEFT JOIN "LedgerEntry" e ON e."accountId" = a."id"
        WHERE a."ownerType" = 'SELLER' AND a."ownerId" = ${order.sellerProfileId}
          AND a."purpose" IN ('SELLER_HELD', 'SELLER_AVAILABLE', 'SELLER_RESERVED')
        GROUP BY a."purpose" ORDER BY a."purpose"
      `,
    ).toEqual(before.balances);
    expect(await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).toEqual(before.order);
    expect(await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).toEqual(
      before.payment,
    );
    expect(await prisma.orderDelivery.findUniqueOrThrow({ where: { orderId: order.id } })).toEqual(
      before.delivery,
    );
  });

  it('honors a retired historical policy under six concurrent workers', async () => {
    const { order, actorUserId } = await completedOrder(1000n, 0);
    const policy = await publishSellerReleasePolicy(actorUserId, 0);
    await service.processOne(order.id);
    await prisma.sellerReleasePolicyVersion.update({
      where: { id: policy.id },
      data: { status: 'RETIRED' },
    });
    const hold = await prisma.financialHold.findFirstOrThrow({ where: { orderId: order.id } });
    const ledgerTransactions = await prisma.ledgerTransaction.count();
    const results = await Promise.all(
      Array.from({ length: 6 }, () => eligibility.processOne(hold.id)),
    );
    expect(results.filter((result) => result === 'RELEASE_ELIGIBLE')).toHaveLength(1);
    expect(results.filter((result) => result === 'ALREADY_ELIGIBLE')).toHaveLength(5);
    expect(await prisma.ledgerTransaction.count()).toBe(ledgerTransactions);
  });

  it('keeps policy A frozen when policy B becomes effective', async () => {
    const { order, actorUserId } = await completedOrder(1000n, 0);
    const policyA = await publishSellerReleasePolicy(actorUserId, 0);
    await service.processOne(order.id);
    const before = await prisma.financialHold.findFirstOrThrow({ where: { orderId: order.id } });
    const ruleA = policyA.rules[0];
    await prisma.sellerReleasePolicyVersion.update({
      where: { id: policyA.id },
      data: { status: 'RETIRED' },
    });
    const policyB = await publishSellerReleasePolicy(actorUserId, 9);

    expect(await eligibility.processOne(before.id)).toBe('RELEASE_ELIGIBLE');
    const after = await prisma.financialHold.findUniqueOrThrow({ where: { id: before.id } });
    expect(after).toMatchObject({
      sellerReleasePolicyVersionId: policyA.id,
      sellerReleasePolicyRuleId: ruleA.id,
      releaseDelayHours: 0,
      releaseEligibleAt: before.releaseEligibleAt,
    });
    expect(after.sellerReleasePolicyVersionId).not.toBe(policyB.id);
  });

  it.each(['OPEN', 'UNDER_REVIEW', 'RESOLVED_BUYER', 'CLOSED'] as const)(
    'business-blocks eligibility for a %s dispute without reconciliation',
    async (disputeStatus) => {
      const { order } = await completedOrder(1000n, 0);
      await service.processOne(order.id);
      const hold = await prisma.financialHold.findFirstOrThrow({ where: { orderId: order.id } });
      await prisma.order.update({ where: { id: order.id }, data: { disputeStatus } });
      expect(await eligibility.processOne(hold.id)).toBe('BUSINESS_BLOCKED');
      expect(
        await prisma.reconciliationIssue.count({
          where: { referenceType: 'SellerHoldEligibility', referenceId: hold.id },
        }),
      ).toBe(0);
      expect(
        (await prisma.financialHold.findUniqueOrThrow({ where: { id: hold.id } })).status,
      ).toBe('ACTIVE');
    },
  );

  it('validates a RELEASE_ELIGIBLE replay before accepting it', async () => {
    const { order, payment, actorUserId } = await completedOrder(1000n, 0);
    await publishSellerReleasePolicy(actorUserId, 0);
    await service.processOne(order.id);
    const hold = await prisma.financialHold.findFirstOrThrow({ where: { orderId: order.id } });
    expect(await eligibility.processOne(hold.id)).toBe('RELEASE_ELIGIBLE');
    await prisma.payment.update({ where: { id: payment.id }, data: { status: 'PENDING' } });
    expect(await eligibility.processOne(hold.id)).toBe('RECONCILIATION_REQUIRED');
    expect(
      await prisma.reconciliationIssue.findFirst({
        where: { referenceType: 'SellerHoldEligibility', referenceId: hold.id, status: 'OPEN' },
      }),
    ).toMatchObject({ details: { errorCode: 'PAYMENT_INVALID' } });
  });

  it('enforces the delivery-protection lifecycle and releasedAt invariants in PostgreSQL', async () => {
    const { order, actorUserId } = await completedOrder(1000n, 0);
    await publishSellerReleasePolicy(actorUserId, 0);
    await service.processOne(order.id);
    const hold = await prisma.financialHold.findFirstOrThrow({ where: { orderId: order.id } });

    await expect(
      prisma.financialHold.update({ where: { id: hold.id }, data: { status: 'RELEASED' } }),
    ).rejects.toBeDefined();
    await expect(
      prisma.financialHold.update({ where: { id: hold.id }, data: { releasedAt: new Date() } }),
    ).rejects.toBeDefined();
    expect(await eligibility.processOne(hold.id)).toBe('RELEASE_ELIGIBLE');
    await expect(
      prisma.financialHold.update({ where: { id: hold.id }, data: { status: 'ACTIVE' } }),
    ).rejects.toBeDefined();
    await expect(
      prisma.financialHold.update({ where: { id: hold.id }, data: { status: 'RELEASED' } }),
    ).rejects.toBeDefined();
    await expect(
      prisma.financialHold.update({ where: { id: hold.id }, data: { releasedAt: new Date() } }),
    ).rejects.toBeDefined();
  });

  it('allows a valid ACTIVE insert but rejects a direct RELEASE_ELIGIBLE insert', async () => {
    const { order, actorUserId } = await completedOrder(1000n, 0);
    await publishSellerReleasePolicy(actorUserId, 0);
    await service.processOne(order.id);
    const hold = await prisma.financialHold.findFirstOrThrow({ where: { orderId: order.id } });
    await prisma.financialHold.delete({ where: { id: hold.id } });
    const data = {
      orderId: hold.orderId,
      paymentId: hold.paymentId,
      sellerProfileId: hold.sellerProfileId,
      ledgerTransactionId: hold.ledgerTransactionId,
      sellerReleasePolicyVersionId: hold.sellerReleasePolicyVersionId,
      sellerReleasePolicyRuleId: hold.sellerReleasePolicyRuleId,
      releaseDelayHours: hold.releaseDelayHours,
      releasePolicyAppliedAt: hold.releasePolicyAppliedAt,
      releaseEligibleAt: hold.releaseEligibleAt,
      amountMinor: hold.amountMinor,
      currency: hold.currency,
      reason: 'DELIVERY_PROTECTION' as const,
      releasedAt: null,
    };
    await expect(
      prisma.financialHold.create({ data: { ...data, status: 'RELEASE_ELIGIBLE' } }),
    ).rejects.toBeDefined();
    const active = await prisma.financialHold.create({ data: { ...data, status: 'ACTIVE' } });
    expect(await eligibility.processOne(active.id)).toBe('RELEASE_ELIGIBLE');
  });

  it('contains no Node clock, PSP, HTTP, scheduler, or monetary posting dependency', () => {
    const source = readFileSync(
      join(__dirname, '../src/financial/seller-hold-eligibility.service.ts'),
      'utf8',
    );
    expect(source).not.toMatch(
      /Date\.now\(|new Date\(|PaymentProviderPort|Efi|fetch\(|axios|setTimeout|setInterval|@Cron|SELLER_AVAILABLE|SELLER_RESERVED/,
    );
    expect(source).not.toMatch(/ledger(Transaction|Entry)\.(create|update)|FinancialEvent/);
  });

  it('durably marks zero proceeds without monetary artifacts or a batch busy loop', async () => {
    const { order, payment } = await completedOrder(10_000n);
    expect(await service.processBatch(1)).toBe(1);
    expect(await service.processBatch(1)).toBe(0);
    expect(
      await prisma.sellerPendingHoldZero.findUnique({ where: { orderId: order.id } }),
    ).toMatchObject({ paymentId: payment.id });
    expect(
      await prisma.ledgerTransaction.count({
        where: { type: 'SELLER_FUNDS_HELD', referenceId: order.id },
      }),
    ).toBe(0);
    expect(await prisma.financialHold.count({ where: { orderId: order.id } })).toBe(0);
    expect(
      await prisma.reconciliationIssue.count({
        where: { referenceType: 'SellerPendingHold', referenceId: order.id },
      }),
    ).toBe(0);
  });

  it('does not claim generic releaseEligibleAt for a MANUAL hold', async () => {
    const { order } = await completedOrder(1000n);
    const eligibleAt = new Date();
    const hold = await prisma.financialHold.create({
      data: {
        sellerProfileId: order.sellerProfileId,
        amountMinor: 1n,
        reason: 'MANUAL',
        releaseEligibleAt: eligibleAt,
      },
    });
    expect(hold.releaseEligibleAt).toEqual(eligibleAt);
    expect(hold.sellerReleasePolicyVersionId).toBeNull();
  });

  it('keeps policy A snapshot after retirement and publication of policy B', async () => {
    const { order, actorUserId, releasePolicy: policyA } = await completedOrder(1000n, 24);
    await prisma.sellerReleasePolicyVersion.update({
      where: { id: policyA.id },
      data: { status: 'RETIRED' },
    });
    const policyB = await publishSellerReleasePolicy(actorUserId, 168);
    expect(await service.processOne(order.id)).toBe('PROCESSED');
    const original = await prisma.financialHold.findFirstOrThrow({ where: { orderId: order.id } });
    expect(await service.processOne(order.id)).toBe('ALREADY_HANDLED');
    expect(await prisma.financialHold.findFirstOrThrow({ where: { orderId: order.id } })).toEqual(
      original,
    );
    expect(original.sellerReleasePolicyVersionId).toBe(policyA.id);
    expect(original.sellerReleasePolicyVersionId).not.toBe(policyB.id);
    expect(original.releaseDelayHours).toBe(24);
  });

  it('database rejects a snapshot delay that differs from its rule', async () => {
    const { order, payment, actorUserId } = await completedOrder(1000n);
    const policy = await publishSellerReleasePolicy(actorUserId, 72);
    const rule = policy.rules[0];
    const recognition = await prisma.ledgerTransaction.findFirstOrThrow({
      where: { type: 'SALE_RECOGNIZED', referenceId: order.id },
    });
    const appliedAt = new Date();
    await expect(
      prisma.financialHold.create({
        data: {
          orderId: order.id,
          paymentId: payment.id,
          sellerProfileId: order.sellerProfileId,
          ledgerTransactionId: recognition.id,
          amountMinor: 9000n,
          reason: 'DELIVERY_PROTECTION',
          sellerReleasePolicyVersionId: policy.id,
          sellerReleasePolicyRuleId: rule.id,
          releaseDelayHours: 24,
          releasePolicyAppliedAt: appliedAt,
          releaseEligibleAt: new Date(appliedAt.getTime() + 24 * 3_600_000),
        },
      }),
    ).rejects.toBeDefined();
  });

  it('database rejects delivery-protection clocks that differ from the authoritative delivery', async () => {
    const { order, payment, delivery } = await completedOrder(1000n, 72);
    const recognition = await prisma.ledgerTransaction.findFirstOrThrow({
      where: { type: 'SALE_RECOGNIZED', referenceId: order.id },
    });
    const delayHours = order.frozenBaseReleaseDelayHours!;
    const base = {
      orderId: order.id,
      paymentId: payment.id,
      sellerProfileId: order.sellerProfileId,
      ledgerTransactionId: recognition.id,
      amountMinor: 9000n,
      reason: 'DELIVERY_PROTECTION' as const,
      sellerReleasePolicyVersionId: order.sellerReleasePolicyVersionId,
      sellerReleasePolicyRuleId: order.sellerReleasePolicyRuleId,
      releaseDelayHours: delayHours,
    };
    const wrongAppliedAt = new Date(delivery.createdAt.getTime() + 1);

    await expect(
      prisma.financialHold.create({
        data: {
          ...base,
          releasePolicyAppliedAt: wrongAppliedAt,
          releaseEligibleAt: new Date(wrongAppliedAt.getTime() + delayHours * 3_600_000),
        },
      }),
    ).rejects.toThrow(/FINANCIAL_HOLD_DELIVERY_CLOCK_INVALID/);
    await expect(
      prisma.financialHold.create({
        data: {
          ...base,
          releasePolicyAppliedAt: delivery.createdAt,
          releaseEligibleAt: new Date(delivery.createdAt.getTime() + delayHours * 3_600_000 + 1),
        },
      }),
    ).rejects.toThrow(/FINANCIAL_HOLD_DELIVERY_CLOCK_INVALID/);
  });

  it('database keeps every applied snapshot field immutable', async () => {
    const { order, actorUserId } = await completedOrder(1000n);
    await publishSellerReleasePolicy(actorUserId, 72);
    await service.processOne(order.id);
    const hold = await prisma.financialHold.findFirstOrThrow({ where: { orderId: order.id } });
    const mutations = [
      { sellerReleasePolicyVersionId: randomUUID() },
      { sellerReleasePolicyRuleId: randomUUID() },
      { releaseDelayHours: 1 },
      { releasePolicyAppliedAt: new Date(0) },
      { releaseEligibleAt: new Date(0) },
      {
        sellerReleasePolicyVersionId: null,
        sellerReleasePolicyRuleId: null,
        releaseDelayHours: null,
        releasePolicyAppliedAt: null,
        releaseEligibleAt: null,
      },
    ];
    for (const data of mutations)
      await expect(
        prisma.financialHold.update({ where: { id: hold.id }, data }),
      ).rejects.toBeDefined();
    expect(await prisma.financialHold.findUniqueOrThrow({ where: { id: hold.id } })).toEqual(hold);
  });

  it('fails closed and deduplicates reconciliation when pending funds are insufficient', async () => {
    const { order, actorUserId } = await completedOrder(1000n);
    await publishSellerReleasePolicy(actorUserId, 72);
    const accounts = await prisma.ledgerAccount.findMany({
      where: { ownerType: 'SELLER', ownerId: order.sellerProfileId },
    });
    const pending = accounts.find((account) => account.purpose === 'SELLER_PENDING')!;
    const held = accounts.find((account) => account.purpose === 'SELLER_HELD')!;
    const ledger = app.get(FinancialLedgerService);
    await ledger.postWithOutcome({
      type: 'TEST_PENDING_CONSUMPTION',
      currency: 'BRL',
      idempotencyKeyHash: randomUUID(),
      referenceType: 'TestPendingConsumption',
      referenceId: order.id,
      entries: [
        { accountId: pending.id, direction: 'DEBIT', amountMinor: 9000n },
        { accountId: held.id, direction: 'CREDIT', amountMinor: 9000n },
      ],
    });
    await Promise.all(Array.from({ length: 6 }, () => service.processOne(order.id)));
    expect(
      await prisma.ledgerTransaction.count({
        where: { type: 'SELLER_FUNDS_HELD', referenceId: order.id },
      }),
    ).toBe(0);
    expect(
      await prisma.reconciliationIssue.count({
        where: { referenceType: 'SellerPendingHold', referenceId: order.id, status: 'OPEN' },
      }),
    ).toBe(1);
  });

  it('does not let a wrong-key seller hold artifact disappear from batch selection', async () => {
    const { order, payment } = await completedOrder(1000n);
    const accounts = await prisma.ledgerAccount.findMany({
      where: { ownerType: 'SELLER', ownerId: order.sellerProfileId },
    });
    const pending = accounts.find((account) => account.purpose === 'SELLER_PENDING')!;
    const held = accounts.find((account) => account.purpose === 'SELLER_HELD')!;
    const ledger = app.get(FinancialLedgerService);
    const wrong = await ledger.postWithOutcome({
      type: 'SELLER_FUNDS_HELD',
      currency: 'BRL',
      idempotencyKeyHash: randomUUID(),
      referenceType: 'OrderSellerHold',
      referenceId: order.id,
      entries: [
        { accountId: pending.id, direction: 'DEBIT', amountMinor: 9000n },
        { accountId: held.id, direction: 'CREDIT', amountMinor: 9000n },
      ],
    });
    await prisma.financialHold.create({
      data: {
        orderId: order.id,
        paymentId: payment.id,
        sellerProfileId: order.sellerProfileId,
        ledgerTransactionId: wrong.transaction.id,
        amountMinor: 9000n,
        reason: 'DELIVERY_PROTECTION',
      },
    });

    expect(await service.processBatch(1)).toBe(1);
    expect(await service.processBatch(1)).toBe(0);
    expect(
      await prisma.reconciliationIssue.findMany({
        where: { referenceType: 'SellerPendingHold', referenceId: order.id, status: 'OPEN' },
      }),
    ).toEqual([
      expect.objectContaining({
        details: { errorCode: 'SELLER_HOLD_LEDGER_IDEMPOTENCY_MISMATCH' },
      }),
    ]);
    expect(
      await prisma.ledgerTransaction.count({
        where: { type: 'SELLER_FUNDS_HELD', referenceId: order.id },
      }),
    ).toBe(1);
  });

  it.each([
    ['missing ledger transaction', { ledgerTransactionId: null }],
    ['zero amount', { amountMinor: 0n }],
    ['non-BRL currency', { currency: 'USD' }],
    ['non-active status', { status: 'BLOCKED' as const }],
    ['released timestamp', { releasedAt: new Date() }],
  ])('database rejects invalid DELIVERY_PROTECTION: %s', async (_name, override) => {
    const { order, payment } = await completedOrder(1000n);
    const recognition = await prisma.ledgerTransaction.findFirstOrThrow({
      where: { type: 'SALE_RECOGNIZED', referenceId: order.id },
    });
    await expect(
      prisma.financialHold.create({
        data: {
          orderId: order.id,
          paymentId: payment.id,
          sellerProfileId: order.sellerProfileId,
          ledgerTransactionId: recognition.id,
          amountMinor: 9000n,
          reason: 'DELIVERY_PROTECTION',
          ...override,
        },
      }),
    ).rejects.toBeDefined();
  });

  it('serializes an OPEN dispute committed before seller-hold validation', async () => {
    const { order } = await completedOrder(1000n);
    let lockAcquired!: () => void;
    let releaseLock!: () => void;
    const acquired = new Promise<void>((resolve) => (lockAcquired = resolve));
    const release = new Promise<void>((resolve) => (releaseLock = resolve));
    const dispute = prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${order.id}::uuid FOR UPDATE`;
      await tx.order.update({ where: { id: order.id }, data: { disputeStatus: 'OPEN' } });
      lockAcquired();
      await release;
    });
    await acquired;
    const holdAttempt = service.processOne(order.id);
    releaseLock();
    const [, holdResult] = await Promise.all([dispute, holdAttempt]);

    expect(holdResult).toBe('PROCESSED');
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).disputeStatus).toBe(
      'OPEN',
    );
    expect(
      await prisma.ledgerTransaction.count({
        where: { type: 'SELLER_FUNDS_HELD', referenceId: order.id },
      }),
    ).toBe(1);
    const hold = await prisma.financialHold.findFirstOrThrow({
      where: { orderId: order.id, reason: 'DELIVERY_PROTECTION' },
    });
    expect(hold.status).toBe('ACTIVE');
    expect(await eligibility.processOne(hold.id)).toBe('BUSINESS_BLOCKED');
    expect(
      await prisma.ledgerTransaction.count({
        where: { type: 'SELLER_FUNDS_RELEASED', referenceId: hold.id },
      }),
    ).toBe(0);
    expect(
      await prisma.reconciliationIssue.count({
        where: { referenceId: { in: [order.id, hold.id] } },
      }),
    ).toBe(0);
  });

  async function eligibleHold(publishCommission = true) {
    const { order, actorUserId } = await completedOrder(
      1000n,
      0,
      'DEFAULT',
      true,
      publishCommission,
    );
    await publishSellerReleasePolicy(actorUserId, 0);
    expect(await service.processOne(order.id)).toBe('PROCESSED');
    const hold = await prisma.financialHold.findFirstOrThrow({ where: { orderId: order.id } });
    expect(await eligibility.processOne(hold.id)).toBe('RELEASE_ELIGIBLE');
    return { order, hold };
  }

  it('atomically releases held proceeds to available and deeply validates replays', async () => {
    const { order, hold } = await eligibleHold();
    const ledger = app.get(FinancialLedgerService);
    expect(await ledger.getSellerFinancialBalance(order.sellerProfileId)).toMatchObject({
      pending: 0n,
      held: 9000n,
      available: 0n,
      reserved: 0n,
    });

    expect(await release.processOne(hold.id)).toBe('RELEASED');
    expect(await release.processOne(hold.id)).toBe('ALREADY_RELEASED');
    expect(await release.processOne(hold.id)).toBe('ALREADY_RELEASED');
    expect(await ledger.getSellerFinancialBalance(order.sellerProfileId)).toMatchObject({
      pending: 0n,
      held: 0n,
      available: 9000n,
      reserved: 0n,
    });
    const released = await prisma.financialHold.findUniqueOrThrow({ where: { id: hold.id } });
    expect(released).toMatchObject({ status: 'RELEASED' });
    expect(released.releasedAt).not.toBeNull();
    expect(released.releaseLedgerTransactionId).not.toBe(released.ledgerTransactionId);
    const postings = await prisma.ledgerTransaction.findMany({
      where: {
        type: 'SELLER_FUNDS_RELEASED',
        referenceType: 'FinancialHoldRelease',
        referenceId: hold.id,
      },
      include: {
        entries: { include: { account: true } },
        financialEvent: { include: { outbox: true } },
      },
    });
    expect(postings).toHaveLength(1);
    expect(postings[0].entries).toHaveLength(2);
    expect(postings[0].financialEvent?.outbox).not.toBeNull();
    expect(released.releasedAt!.getTime()).toBeGreaterThanOrEqual(
      released.releaseEligibleAt!.getTime(),
    );
    expect(postings[0].createdAt.getTime()).toBeGreaterThanOrEqual(
      released.releaseEligibleAt!.getTime(),
    );
    expect(postings[0].createdAt.getTime()).toBe(released.releasedAt!.getTime());
  });

  it('fails closed when authoritative delivery disappears after eligibility', async () => {
    const { order, hold } = await eligibleHold();
    const ledger = app.get(FinancialLedgerService);
    const beforeBalance = await ledger.getSellerFinancialBalance(order.sellerProfileId);
    expect((await prisma.financialHold.findUniqueOrThrow({ where: { id: hold.id } })).status).toBe(
      'RELEASE_ELIGIBLE',
    );

    await prisma.orderDelivery.delete({ where: { orderId: order.id } });

    expect(await release.processOne(hold.id)).toBe('RECONCILIATION_REQUIRED');
    expect(await prisma.financialHold.findUniqueOrThrow({ where: { id: hold.id } })).toMatchObject({
      status: 'RELEASE_ELIGIBLE',
      releaseLedgerTransactionId: null,
      releasedAt: null,
    });
    expect(await ledger.getSellerFinancialBalance(order.sellerProfileId)).toEqual(beforeBalance);
    expect(
      await prisma.ledgerTransaction.count({
        where: { type: 'SELLER_FUNDS_RELEASED', referenceId: hold.id },
      }),
    ).toBe(0);
    expect(
      await prisma.reconciliationIssue.findMany({
        where: {
          referenceType: 'SellerHeldFundsRelease',
          referenceId: hold.id,
          status: 'OPEN',
        },
        select: { details: true },
      }),
    ).toEqual([{ details: { errorCode: 'DELIVERY_AUTHORITY_INVALID' } }]);
  });

  it('rejects RELEASED when releasedAt is before releaseEligibleAt at the database boundary', async () => {
    const { hold } = await eligibleHold();
    const original = await prisma.ledgerTransaction.findUniqueOrThrow({
      where: { id: hold.ledgerTransactionId! },
    });
    await expect(
      prisma.$executeRaw`
        UPDATE "FinancialHold" SET "status" = 'RELEASED',
          "releaseLedgerTransactionId" = ${original.id}::uuid,
          "releasedAt" = "releaseEligibleAt" - interval '1 millisecond'
        WHERE "id" = ${hold.id}::uuid
      `,
    ).rejects.toBeDefined();
    expect((await prisma.financialHold.findUniqueOrThrow({ where: { id: hold.id } })).status).toBe(
      'RELEASE_ELIGIBLE',
    );
  });

  it('validates release history rather than mutable dispute state on replay', async () => {
    const { order, hold } = await eligibleHold();
    expect(await release.processOne(hold.id)).toBe('RELEASED');
    const beforeHold = await prisma.financialHold.findUniqueOrThrow({ where: { id: hold.id } });
    const beforeBalance = await app
      .get(FinancialLedgerService)
      .getSellerFinancialBalance(order.sellerProfileId);
    const before = {
      transactions: await prisma.ledgerTransaction.count(),
      entries: await prisma.ledgerEntry.count(),
      events: await prisma.financialEvent.count(),
      outbox: await prisma.financialOutboxEvent.count(),
    };
    await prisma.order.update({ where: { id: order.id }, data: { disputeStatus: 'OPEN' } });

    expect(await release.processOne(hold.id)).toBe('ALREADY_RELEASED');
    expect(await prisma.financialHold.findUniqueOrThrow({ where: { id: hold.id } })).toMatchObject({
      status: 'RELEASED',
      releasedAt: beforeHold.releasedAt,
      releaseLedgerTransactionId: beforeHold.releaseLedgerTransactionId,
    });
    expect(
      await app.get(FinancialLedgerService).getSellerFinancialBalance(order.sellerProfileId),
    ).toEqual(beforeBalance);
    expect({
      transactions: await prisma.ledgerTransaction.count(),
      entries: await prisma.ledgerEntry.count(),
      events: await prisma.financialEvent.count(),
      outbox: await prisma.financialOutboxEvent.count(),
    }).toEqual(before);
  });

  it.each(['OPEN', 'UNDER_REVIEW'] as const)(
    'business-blocks a new release for a %s dispute',
    async (disputeStatus) => {
      const { order, hold } = await eligibleHold();
      await prisma.order.update({ where: { id: order.id }, data: { disputeStatus } });
      expect(await release.processOne(hold.id)).toBe('BUSINESS_BLOCKED');
      expect(
        await prisma.ledgerTransaction.count({
          where: { type: 'SELLER_FUNDS_RELEASED', referenceId: hold.id },
        }),
      ).toBe(0);
      expect(
        (await prisma.financialHold.findUniqueOrThrow({ where: { id: hold.id } })).status,
      ).toBe('RELEASE_ELIGIBLE');
      expect(
        await prisma.reconciliationIssue.count({
          where: { referenceType: 'SellerHeldFundsRelease', referenceId: hold.id },
        }),
      ).toBe(0);
    },
  );

  it('releases a due hold after a seller resolution without a new deadline', async () => {
    const { order } = await completedOrder(1000n, 0, 'DEFAULT', false);
    expect(await service.processOne(order.id)).toBe('PROCESSED');
    const hold = await prisma.financialHold.findFirstOrThrow({ where: { orderId: order.id } });
    await prisma.order.update({
      where: { id: order.id },
      data: { disputeStatus: 'RESOLVED_SELLER' },
    });

    expect(await eligibility.processOne(hold.id)).toBe('RELEASE_ELIGIBLE');
    expect(await release.processOne(hold.id)).toBe('RELEASED');
  });

  it('skips a blocked automatic candidate so a later releasable hold stays live', async () => {
    const blocked = await eligibleHold();
    await prisma.order.update({
      where: { id: blocked.order.id },
      data: { disputeStatus: 'OPEN' },
    });
    const releasable = await eligibleHold(false);

    expect(await release.processOne()).toBe('RELEASED');
    expect(
      (await prisma.financialHold.findUniqueOrThrow({ where: { id: blocked.hold.id } })).status,
    ).toBe('RELEASE_ELIGIBLE');
    expect(
      (await prisma.financialHold.findUniqueOrThrow({ where: { id: releasable.hold.id } })).status,
    ).toBe('RELEASED');
  });

  it('converges six concurrent workers on exactly one monetary release', async () => {
    const { order, hold } = await eligibleHold();
    const outcomes = await Promise.all(
      Array.from({ length: 6 }, () => release.processOne(hold.id)),
    );
    expect(outcomes.filter((value) => value === 'RELEASED')).toHaveLength(1);
    expect(outcomes.filter((value) => value === 'ALREADY_RELEASED')).toHaveLength(5);
    expect(
      await prisma.ledgerTransaction.count({
        where: { type: 'SELLER_FUNDS_RELEASED', referenceId: hold.id },
      }),
    ).toBe(1);
    expect(
      (await app.get(FinancialLedgerService).getSellerFinancialBalance(order.sellerProfileId))
        .available,
    ).toBe(9000n);
  });

  it('observes an OPEN dispute that wins the order lock before release', async () => {
    const { hold } = await eligibleHold();
    let locked!: () => void;
    let unlock!: () => void;
    const acquired = new Promise<void>((resolve) => (locked = resolve));
    const gate = new Promise<void>((resolve) => (unlock = resolve));
    const dispute = prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${hold.orderId}::uuid FOR UPDATE`;
      await tx.order.update({ where: { id: hold.orderId! }, data: { disputeStatus: 'OPEN' } });
      locked();
      await gate;
    });
    await acquired;
    const attempt = release.processOne(hold.id);
    unlock();
    await dispute;
    expect(await attempt).toBe('BUSINESS_BLOCKED');
    expect((await prisma.financialHold.findUniqueOrThrow({ where: { id: hold.id } })).status).toBe(
      'RELEASE_ELIGIBLE',
    );
    expect(
      await prisma.ledgerTransaction.count({
        where: { type: 'SELLER_FUNDS_RELEASED', referenceId: hold.id },
      }),
    ).toBe(0);
  });

  it('contains no PSP, HTTP, withdrawal, timer, or release-to-available dependency', () => {
    const source = readFileSync(
      join(__dirname, '../src/financial/seller-pending-hold.service.ts'),
      'utf8',
    );
    expect(source).not.toMatch(
      /PaymentProviderPort|Efi|fetch\(|axios|setTimeout|Withdrawal|SELLER_AVAILABLE|SELLER_RESERVED/,
    );
    expect(source).not.toMatch(/prisma\.ledger(Transaction|Entry)\.create/);
    expect(readFileSync(__filename, 'utf8')).not.toContain('session_' + 'replication_role');
  });
});
