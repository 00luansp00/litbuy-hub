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
import { SellerHoldEligibilityService } from '../src/financial/seller-hold-eligibility.service';
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
    extraRule?: { code: string; delayHours: number },
  ) {
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

  async function completedOrder(fee: bigint) {
    const fixture = await commerceFixture(prisma, 'NORMAL', undefined, 20, false);
    await publishPlatformCommissionPolicy(prisma, fixture.sellerUser.id, {
      publicVersion: version++,
      fixedAmountMinor: fee,
    });
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
    await recognition.processOne(order.id);
    await fulfillment.makeAvailable(order.id);
    await fulfillment.recordDelivered({
      orderCode: order.publicCode,
      actorUserId: fixture.sellerUser.id,
      deliveryType: 'MANUAL_REFERENCE',
      evidenceHash: 'a'.repeat(64),
    });
    await fulfillment.confirmReceipt(order.publicCode, fixture.buyer.id);
    return {
      order: await prisma.order.findUniqueOrThrow({ where: { id: order.id } }),
      payment,
      actorUserId: fixture.sellerUser.id,
    };
  }

  it('moves the snapshot proceeds from pending to held without available or reserved entries', async () => {
    const { order, payment, actorUserId } = await completedOrder(1000n);
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
    expect(hold.releaseEligibleAt!.getTime()).toBe(
      hold.releasePolicyAppliedAt!.getTime() + 72 * 3_600_000,
    );
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

  it('fails closed without an effective policy and does not move pending funds', async () => {
    const { order } = await completedOrder(1000n);
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

  it('fails closed for an ambiguous enabled rule set without partial artifacts', async () => {
    const { order, actorUserId } = await completedOrder(1000n);
    await publishSellerReleasePolicy(actorUserId, 72, {
      code: 'UNEXPECTED_ENABLED',
      delayHours: 1,
    });
    expect(await service.processOne(order.id)).toBe('PROCESSED');
    expect(
      await prisma.ledgerTransaction.count({
        where: { type: 'SELLER_FUNDS_HELD', referenceId: order.id },
      }),
    ).toBe(0);
    expect(await prisma.financialHold.count({ where: { orderId: order.id } })).toBe(0);
    expect(
      await prisma.reconciliationIssue.findFirst({
        where: { referenceType: 'SellerPendingHold', referenceId: order.id, status: 'OPEN' },
      }),
    ).toMatchObject({ details: { errorCode: 'SELLER_RELEASE_POLICY_AMBIGUOUS' } });
  });

  it('keeps delay zero scheduled and ACTIVE without releasing funds', async () => {
    const { order, actorUserId } = await completedOrder(1000n);
    await publishSellerReleasePolicy(actorUserId, 0);
    expect(await service.processOne(order.id)).toBe('PROCESSED');
    const hold = await prisma.financialHold.findFirstOrThrow({ where: { orderId: order.id } });
    expect(hold.releaseEligibleAt).toEqual(hold.releasePolicyAppliedAt);
    expect(hold.status).toBe('ACTIVE');
    expect(hold.releasedAt).toBeNull();
    const ledgerEntries = await prisma.ledgerEntry.count();
    expect(await eligibility.processOne(hold.id)).toBe('RELEASE_ELIGIBLE');
    expect(await eligibility.processOne(hold.id)).toBe('ALREADY_ELIGIBLE');
    expect(await prisma.financialHold.findUniqueOrThrow({ where: { id: hold.id } })).toMatchObject({
      status: 'RELEASE_ELIGIBLE',
      releasedAt: null,
    });
    expect(await prisma.ledgerEntry.count()).toBe(ledgerEntries);
  });

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

  it('honors a retired historical policy under six concurrent workers', async () => {
    const { order, actorUserId } = await completedOrder(1000n);
    const policy = await publishSellerReleasePolicy(actorUserId, 0);
    await service.processOne(order.id);
    await prisma.sellerReleasePolicyVersion.update({
      where: { id: policy.id },
      data: { status: 'RETIRED', effectiveTo: new Date() },
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
    const { order, actorUserId } = await completedOrder(1000n);
    const policyA = await publishSellerReleasePolicy(actorUserId, 24);
    expect(await service.processOne(order.id)).toBe('PROCESSED');
    const original = await prisma.financialHold.findFirstOrThrow({ where: { orderId: order.id } });
    await prisma.sellerReleasePolicyVersion.update({
      where: { id: policyA.id },
      data: { status: 'RETIRED' },
    });
    await publishSellerReleasePolicy(actorUserId, 168);
    expect(await service.processOne(order.id)).toBe('ALREADY_HANDLED');
    expect(await prisma.financialHold.findFirstOrThrow({ where: { orderId: order.id } })).toEqual(
      original,
    );
    expect(original.sellerReleasePolicyVersionId).toBe(policyA.id);
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

  it.each(['OPEN', 'UNDER_REVIEW'] as const)(
    'business-blocks a %s dispute without reconciliation',
    async (disputeStatus) => {
      const { order } = await completedOrder(1000n);
      await prisma.order.update({ where: { id: order.id }, data: { disputeStatus } });
      expect(await service.processOne(order.id)).toBe('ALREADY_HANDLED');
      expect(
        await prisma.ledgerTransaction.count({
          where: { type: 'SELLER_FUNDS_HELD', referenceId: order.id },
        }),
      ).toBe(0);
      expect(
        await prisma.reconciliationIssue.count({
          where: { referenceType: 'SellerPendingHold', referenceId: order.id },
        }),
      ).toBe(0);
    },
  );

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
    await Promise.all([dispute, holdAttempt]);

    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).disputeStatus).toBe(
      'OPEN',
    );
    expect(
      await prisma.ledgerTransaction.count({
        where: { type: 'SELLER_FUNDS_HELD', referenceId: order.id },
      }),
    ).toBe(0);
    expect(await prisma.financialHold.count({ where: { orderId: order.id } })).toBe(0);
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
