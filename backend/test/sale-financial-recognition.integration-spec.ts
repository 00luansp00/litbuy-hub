import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { CartsService } from '../src/carts/carts.service';
import { parseIdempotencyKey } from '../src/commerce/idempotency-key';
import { CheckoutService } from '../src/checkout/checkout.service';
import { PrismaService } from '../src/database/prisma.service';
import { FinancialLedgerService } from '../src/financial/financial-ledger.service';
import { SaleFinancialRecognitionService } from '../src/financial/sale-financial-recognition.service';
import { PaidOrderActivationService } from '../src/orders/paid-order-activation.service';
import { commerceFixture, publishPlatformCommissionPolicy } from './order-checkout-test.helpers';

const cleanupSql = 'TRUNCATE TABLE "User", "CatalogCategory" CASCADE';
const recognitionKey = (orderId: string) =>
  createHash('sha256').update(`sale-recognition:v1:${orderId}`).digest('hex');

describe('SaleFinancialRecognitionService with real PostgreSQL', () => {
  jest.setTimeout(120_000);
  let app: Awaited<ReturnType<ReturnType<typeof Test.createTestingModule>['compile']>>;
  let prisma: PrismaService;
  let carts: CartsService;
  let checkout: CheckoutService;
  let activation: PaidOrderActivationService;
  let recognition: SaleFinancialRecognitionService;
  let ledger: FinancialLedgerService;
  let publicVersion = 1;

  beforeAll(async () => {
    app = await Test.createTestingModule({ imports: [AppModule] }).compile();
    prisma = app.get(PrismaService);
    carts = app.get(CartsService);
    checkout = app.get(CheckoutService);
    activation = app.get(PaidOrderActivationService);
    recognition = app.get(SaleFinancialRecognitionService);
    ledger = app.get(FinancialLedgerService);
  });
  beforeEach(() => prisma.$executeRawUnsafe(cleanupSql));
  afterEach(() => prisma.$executeRawUnsafe(cleanupSql));
  afterAll(() => app.close());

  async function activePaidOrder(
    options: { fee?: bigint; quantity?: number; stock?: number } = {},
  ) {
    const fee = options.fee ?? 1000n;
    const quantity = options.quantity ?? 1;
    const fixture = await commerceFixture(prisma, 'NORMAL', undefined, options.stock ?? 20, false);
    const policy = await publishPlatformCommissionPolicy(prisma, fixture.sellerUser.id, {
      publicVersion: publicVersion++,
      fixedAmountMinor: fee,
    });
    const preview = await carts.add(fixture.buyer.id, fixture.seller.slug, {
      productId: fixture.product.id,
      quantity,
      expectedVersion: 0,
    });
    const response = await checkout.create(
      fixture.buyer.id,
      parseIdempotencyKey(`sale-recognition:${randomUUID()}`),
      {
        sellerSlug: fixture.seller.slug,
        expectedCartVersion: preview.version,
        expectedPreviewFingerprint: preview.previewFingerprint,
      },
    );
    const order = await prisma.order.findUniqueOrThrow({
      where: { publicCode: (response as { orderCode: string }).orderCode },
      include: { items: true, reservations: true },
    });
    const payment = await prisma.payment.create({
      data: {
        orderId: order.id,
        amountMinor: order.totalAmountMinor,
        currency: 'BRL',
        status: 'PAID',
        paidAt: new Date(),
      },
    });
    const attempt = await prisma.paymentAttempt.create({
      data: {
        paymentId: payment.id,
        attemptNumber: 1,
        providerCode: 'LOCAL_TEST',
        status: 'SUCCEEDED',
        amountMinor: payment.amountMinor,
        currency: 'BRL',
        externalPaymentId: `pay-${randomUUID()}`,
        idempotencyKeyHash: randomUUID(),
        requestHash: randomUUID(),
      },
    });
    await prisma.order.update({ where: { id: order.id }, data: { paymentStatus: 'PENDING' } });
    await activation.processOne(order.id);
    return {
      fixture,
      policy,
      payment,
      attempt,
      order: await prisma.order.findUniqueOrThrow({
        where: { id: order.id },
        include: { items: true, reservations: true },
      }),
    };
  }

  async function entriesFor(orderId: string) {
    return prisma.ledgerEntry.findMany({
      where: { transaction: { type: 'SALE_RECOGNIZED', referenceId: orderId } },
      include: { account: true, transaction: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async function accountNet(purpose: string, ownerType?: string) {
    const rows = await prisma.ledgerEntry.findMany({
      where: {
        account: {
          purpose: purpose as never,
          ...(ownerType ? { ownerType: ownerType as never } : {}),
        },
      },
      include: { account: true },
    });
    return rows.reduce((sum, entry) => {
      const sign =
        entry.account.accountClass === 'LIABILITY' || entry.account.accountClass === 'REVENUE'
          ? entry.direction === 'CREDIT'
            ? 1n
            : -1n
          : entry.direction === 'DEBIT'
            ? 1n
            : -1n;
      return sum + sign * entry.amountMinor;
    }, 0n);
  }

  async function expectSingleIssue(orderId: string, errorCode: string) {
    await recognition.processOne(orderId);
    await recognition.processOne(orderId);
    expect(
      await prisma.ledgerTransaction.count({
        where: { type: 'SALE_RECOGNIZED', referenceId: orderId },
      }),
    ).toBe(0);
    expect(
      await prisma.ledgerEntry.count({
        where: { transaction: { type: 'SALE_RECOGNIZED', referenceId: orderId } },
      }),
    ).toBe(0);
    expect(await prisma.financialEvent.count({ where: { aggregateId: orderId } })).toBe(0);
    expect(
      await prisma.financialOutboxEvent.count({
        where: { financialEvent: { aggregateId: orderId } },
      }),
    ).toBe(0);
    const issues = await prisma.reconciliationIssue.findMany({
      where: { referenceType: 'SaleFinancialRecognition', referenceId: orderId, status: 'OPEN' },
    });
    expect(issues).toHaveLength(1);
    expect(issues[0].details).toEqual({ errorCode });
  }

  it('posts the primary 10000/1000/9000 accounting case exactly once', async () => {
    const { fixture, order } = await activePaidOrder({ fee: 1000n, quantity: 10, stock: 20 });
    expect(order.totalAmountMinor).toBe(10000n);
    await recognition.processOne(order.id);

    const txs = await prisma.ledgerTransaction.findMany({
      where: { type: 'SALE_RECOGNIZED', referenceType: 'OrderSale', referenceId: order.id },
      include: { entries: { include: { account: true } } },
    });
    expect(txs).toHaveLength(1);
    expect(txs[0]).toMatchObject({ currency: 'BRL', idempotencyKeyHash: recognitionKey(order.id) });
    expect(txs[0].metadata).toMatchObject({
      grossAmountMinor: '10000',
      platformCommissionMinor: '1000',
      sellerProceedsMinor: '9000',
    });
    expect(txs[0].entries).toHaveLength(3);
    const debits = txs[0].entries
      .filter((entry) => entry.direction === 'DEBIT')
      .reduce((n, e) => n + e.amountMinor, 0n);
    const credits = txs[0].entries
      .filter((entry) => entry.direction === 'CREDIT')
      .reduce((n, e) => n + e.amountMinor, 0n);
    expect(debits).toBe(10000n);
    expect(credits).toBe(10000n);
    expect(
      txs[0].entries.map((entry) => ({
        purpose: entry.account.purpose,
        ownerType: entry.account.ownerType,
        direction: entry.direction,
        amount: entry.amountMinor,
      })),
    ).toEqual(
      expect.arrayContaining([
        { purpose: 'PROVIDER_CLEARING', ownerType: 'SYSTEM', direction: 'DEBIT', amount: 10000n },
        { purpose: 'SELLER_PENDING', ownerType: 'SELLER', direction: 'CREDIT', amount: 9000n },
        {
          purpose: 'PLATFORM_COMMISSION',
          ownerType: 'PLATFORM',
          direction: 'CREDIT',
          amount: 1000n,
        },
      ]),
    );
    expect(await ledger.getSellerFinancialBalance(fixture.seller.id)).toMatchObject({
      pending: 9000n,
      held: 0n,
      available: 0n,
      reserved: 0n,
    });
    expect(await accountNet('PLATFORM_COMMISSION', 'PLATFORM')).toBe(1000n);
    expect(await accountNet('PROVIDER_CLEARING', 'SYSTEM')).toBe(10000n);
    expect(await prisma.financialEvent.count({ where: { ledgerTransactionId: txs[0].id } })).toBe(
      1,
    );
    expect(
      await prisma.financialOutboxEvent.count({
        where: { financialEvent: { ledgerTransactionId: txs[0].id } },
      }),
    ).toBe(1);
  });

  it('distinguishes created postings from replay for processBatch concurrency', async () => {
    const one = await activePaidOrder({ fee: 100n });
    const batchResults = await Promise.all([
      recognition.processBatch(1),
      recognition.processBatch(1),
    ]);
    expect(batchResults.reduce((n, value) => n + value, 0)).toBe(1);
    expect(
      await prisma.ledgerTransaction.count({
        where: { type: 'SALE_RECOGNIZED', referenceId: one.order.id },
      }),
    ).toBe(1);
    const replay = await recognition.processBatch(1);
    expect(replay).toBe(0);

    const orders = await Promise.all([
      activePaidOrder({ fee: 100n }),
      activePaidOrder({ fee: 100n }),
      activePaidOrder({ fee: 100n }),
    ]);
    const results = await Promise.all([recognition.processBatch(2), recognition.processBatch(2)]);
    expect(results.reduce((n, value) => n + value, 0)).toBe(3);
    for (const { order } of orders)
      expect(
        await prisma.ledgerTransaction.count({
          where: { type: 'SALE_RECOGNIZED', referenceId: order.id },
        }),
      ).toBe(1);
  });

  it('handles six concurrent processOne calls without duplicate posting or outbox', async () => {
    const { order } = await activePaidOrder({ fee: 1000n, quantity: 10 });
    await Promise.all(Array.from({ length: 6 }, () => recognition.processOne(order.id)));
    expect(
      await prisma.ledgerTransaction.count({
        where: { type: 'SALE_RECOGNIZED', referenceId: order.id },
      }),
    ).toBe(1);
    expect(await entriesFor(order.id)).toHaveLength(3);
    expect(
      await prisma.financialEvent.count({
        where: { aggregateId: order.id, type: 'SALE_RECOGNIZED' },
      }),
    ).toBe(1);
    expect(
      await prisma.financialOutboxEvent.count({ where: { eventType: 'SALE_RECOGNIZED' } }),
    ).toBe(1);
  });

  it('omits zero and full-fee entries correctly', async () => {
    const zero = await activePaidOrder({ fee: 0n });
    await recognition.processOne(zero.order.id);
    expect(await ledger.getSellerFinancialBalance(zero.fixture.seller.id)).toMatchObject({
      pending: 1000n,
      held: 0n,
      available: 0n,
      reserved: 0n,
    });
    const zeroEntries = await entriesFor(zero.order.id);
    expect(zeroEntries.some((entry) => entry.amountMinor === 0n)).toBe(false);
    expect(zeroEntries.some((entry) => entry.account.purpose === 'PLATFORM_COMMISSION')).toBe(
      false,
    );

    await prisma.$executeRawUnsafe(cleanupSql);
    const full = await activePaidOrder({ fee: 1000n });
    await recognition.processOne(full.order.id);
    const fullEntries = await entriesFor(full.order.id);
    expect(fullEntries.some((entry) => entry.amountMinor === 0n)).toBe(false);
    expect(fullEntries.some((entry) => entry.account.purpose === 'SELLER_PENDING')).toBe(false);
    expect(
      fullEntries.some(
        (entry) => entry.account.purpose === 'PLATFORM_COMMISSION' && entry.amountMinor === 1000n,
      ),
    ).toBe(true);
  });

  it('opens exactly one issue for idempotency conflicts and validates the partial unique index', async () => {
    const { order } = await activePaidOrder({ fee: 100n });
    const accounts = await ledger.ensureSystemLedgerAccounts();
    const sellerAccounts = await ledger.ensureSellerLedgerAccounts(order.sellerProfileId);
    await ledger.post({
      type: 'CONFLICT_SEED',
      currency: 'BRL',
      idempotencyKeyHash: recognitionKey(order.id),
      entries: [
        {
          accountId: accounts.find((a) => a.purpose === 'PROVIDER_CLEARING')!.id,
          direction: 'DEBIT',
          amountMinor: 1n,
        },
        {
          accountId: sellerAccounts.find((a) => a.purpose === 'SELLER_PENDING')!.id,
          direction: 'CREDIT',
          amountMinor: 1n,
        },
      ],
      metadata: { conflict: true },
    });
    await Promise.all([recognition.processOne(order.id), recognition.processOne(order.id)]);
    expect(
      await prisma.ledgerTransaction.count({
        where: { type: 'SALE_RECOGNIZED', referenceId: order.id },
      }),
    ).toBe(0);
    await expectSingleIssue(order.id, 'SALE_LEDGER_IDEMPOTENCY_MISMATCH');

    await prisma.$executeRawUnsafe(cleanupSql);
    const seeded = await activePaidOrder({ fee: 100n });
    const seededAccounts = await ledger.ensureSystemLedgerAccounts();
    const seededSellerAccounts = await ledger.ensureSellerLedgerAccounts(
      seeded.order.sellerProfileId,
    );
    await ledger.post({
      type: 'SALE_RECOGNIZED',
      currency: 'BRL',
      idempotencyKeyHash: randomUUID(),
      referenceType: 'OrderSale',
      referenceId: seeded.order.id,
      entries: [
        {
          accountId: seededAccounts.find((a) => a.purpose === 'PROVIDER_CLEARING')!.id,
          direction: 'DEBIT',
          amountMinor: 1n,
        },
        {
          accountId: seededSellerAccounts.find((a) => a.purpose === 'SELLER_PENDING')!.id,
          direction: 'CREDIT',
          amountMinor: 1n,
        },
      ],
    });
    await recognition.processOne(seeded.order.id);
    await expectSingleIssue(seeded.order.id, 'SALE_LEDGER_IDEMPOTENCY_MISMATCH');
    await expect(
      ledger.post({
        type: 'SALE_RECOGNIZED',
        currency: 'BRL',
        idempotencyKeyHash: randomUUID(),
        referenceType: 'OrderSale',
        referenceId: seeded.order.id,
        entries: [
          {
            accountId: seededAccounts.find((a) => a.purpose === 'PROVIDER_CLEARING')!.id,
            direction: 'DEBIT',
            amountMinor: 1n,
          },
          {
            accountId: seededSellerAccounts.find((a) => a.purpose === 'SELLER_PENDING')!.id,
            direction: 'CREDIT',
            amountMinor: 1n,
          },
        ],
      }),
    ).rejects.toThrow();
  });

  it('deduplicates concurrent reconciliation and lets RESOLVED issues be evaluated again', async () => {
    const { order } = await activePaidOrder({ fee: 100n });
    await prisma.payment.delete({ where: { orderId: order.id } });
    await Promise.all(Array.from({ length: 6 }, () => recognition.processOne(order.id)));
    let issues = await prisma.reconciliationIssue.findMany({
      where: { referenceType: 'SaleFinancialRecognition', referenceId: order.id },
    });
    expect(issues).toHaveLength(1);
    expect(issues[0].details).toEqual({ errorCode: 'PAYMENT_MISSING' });
    expect(await recognition.processBatch(10)).toBe(0);
    await prisma.reconciliationIssue.update({
      where: { id: issues[0].id },
      data: { status: 'RESOLVED', resolvedAt: new Date() },
    });
    await recognition.processOne(order.id);
    issues = await prisma.reconciliationIssue.findMany({
      where: { referenceType: 'SaleFinancialRecognition', referenceId: order.id },
    });
    expect(issues).toHaveLength(2);
  });

  it.each([
    [
      'Order not ACTIVE',
      async (id: string) => prisma.order.update({ where: { id }, data: { status: 'COMPLETED' } }),
      'ORDER_NOT_ACTIVE',
    ],
    [
      'Order paymentStatus mismatch',
      async (id: string) =>
        prisma.order.update({ where: { id }, data: { paymentStatus: 'PENDING' } }),
      'ORDER_PAYMENT_STATUS_MISMATCH',
    ],
    [
      'Payment missing',
      async (id: string) => {
        await prisma.paymentAttempt.deleteMany({ where: { payment: { orderId: id } } });
        await prisma.payment.delete({ where: { orderId: id } });
      },
      'PAYMENT_MISSING',
    ],
    [
      'Payment not paid',
      async (id: string) =>
        prisma.payment.update({ where: { orderId: id }, data: { status: 'FAILED' } }),
      'PAYMENT_NOT_PAID',
    ],
    [
      'paidAt missing',
      async (id: string) =>
        prisma.payment.update({ where: { orderId: id }, data: { paidAt: null } }),
      'PAYMENT_PAID_AT_MISSING',
    ],
    [
      'payment amount mismatch',
      async (id: string) =>
        prisma.payment.update({ where: { orderId: id }, data: { amountMinor: 999n } }),
      'PAYMENT_AMOUNT_MISMATCH',
    ],
    [
      'SUCCEEDED attempt missing',
      async (id: string) =>
        prisma.paymentAttempt.updateMany({
          where: { payment: { orderId: id } },
          data: { status: 'FAILED' },
        }),
      'SUCCEEDED_ATTEMPT_MISSING',
    ],
    [
      'multiple SUCCEEDED attempts',
      async (id: string) => {
        const p = await prisma.payment.findUniqueOrThrow({ where: { orderId: id } });
        await prisma.paymentAttempt.create({
          data: {
            paymentId: p.id,
            attemptNumber: 2,
            providerCode: 'LOCAL_TEST',
            status: 'SUCCEEDED',
            amountMinor: p.amountMinor,
            currency: 'BRL',
            externalPaymentId: `pay-${randomUUID()}`,
            idempotencyKeyHash: randomUUID(),
            requestHash: randomUUID(),
          },
        });
      },
      'MULTIPLE_SUCCEEDED_ATTEMPTS',
    ],
    [
      'attempt amount mismatch',
      async (id: string) =>
        prisma.paymentAttempt.updateMany({
          where: { payment: { orderId: id } },
          data: { amountMinor: 999n },
        }),
      'SUCCEEDED_ATTEMPT_MISMATCH',
    ],
    [
      'providerCode empty',
      async (id: string) =>
        prisma.paymentAttempt.updateMany({
          where: { payment: { orderId: id } },
          data: { providerCode: '   ' },
        }),
      'SUCCEEDED_ATTEMPT_MISMATCH',
    ],
    [
      'externalPaymentId missing',
      async (id: string) =>
        prisma.paymentAttempt.updateMany({
          where: { payment: { orderId: id } },
          data: { externalPaymentId: null },
        }),
      'SUCCEEDED_ATTEMPT_MISMATCH',
    ],
    [
      'pricing version mismatch',
      async (id: string) =>
        prisma.$executeRaw`UPDATE "Order" SET "pricingPolicyVersion" = 999 WHERE "id" = ${id}::uuid`,
      'PRICING_POLICY_VERSION_MISMATCH',
    ],
  ])('fails closed for %s', async (_name, mutate, code) => {
    const { order } = await activePaidOrder({ fee: 100n });
    await mutate(order.id);
    await expectSingleIssue(order.id, code);
  });

  it('fails closed for legacy and commission snapshot mismatch without disabling triggers', async () => {
    const fixture = await commerceFixture(prisma, 'NORMAL', undefined, 5, false);
    const cart = await prisma.cart.create({
      data: { buyerUserId: fixture.buyer.id, sellerProfileId: fixture.seller.id },
    });
    const order = await prisma.order.create({
      data: {
        publicCode: `legacy-${randomUUID()}`,
        sourceCartId: cart.id,
        sourceCartVersion: 1,
        buyerUserId: fixture.buyer.id,
        sellerProfileId: fixture.seller.id,
        subtotalAmountMinor: 1000n,
        totalAmountMinor: 1000n,
        platformFeeAmountMinor: 0n,
        status: 'ACTIVE',
        paymentStatus: 'PAID',
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    const payment = await prisma.payment.create({
      data: {
        orderId: order.id,
        amountMinor: 1000n,
        currency: 'BRL',
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
        amountMinor: 1000n,
        currency: 'BRL',
        externalPaymentId: `pay-${randomUUID()}`,
        idempotencyKeyHash: randomUUID(),
        requestHash: randomUUID(),
      },
    });
    await expectSingleIssue(order.id, 'ORDER_PRICING_SNAPSHOT_MISSING');
  });

  it('keeps historical retired policy snapshot and ignores a new active policy', async () => {
    const { order, policy } = await activePaidOrder({ fee: 1000n, quantity: 10 });
    await prisma.feePolicyVersion.update({ where: { id: policy.id }, data: { status: 'RETIRED' } });
    await publishPlatformCommissionPolicy(prisma, order.buyerUserId, {
      publicVersion: 999,
      fixedAmountMinor: 9000n,
    });
    await recognition.processOne(order.id);
    const tx = await prisma.ledgerTransaction.findFirstOrThrow({
      where: { type: 'SALE_RECOGNIZED', referenceId: order.id },
    });
    expect(tx.metadata).toMatchObject({
      platformCommissionMinor: '1000',
      sellerProceedsMinor: '9000',
    });
  });

  it('accumulates seller pending by seller while sharing system and platform accounts', async () => {
    const a = await activePaidOrder({ fee: 100n });
    const b = await activePaidOrder({ fee: 200n });
    await recognition.processOne(a.order.id);
    await recognition.processOne(b.order.id);
    expect(await ledger.getSellerFinancialBalance(a.fixture.seller.id)).toMatchObject({
      pending: 900n,
    });
    expect(await ledger.getSellerFinancialBalance(b.fixture.seller.id)).toMatchObject({
      pending: 800n,
    });
    const systemAccounts = await prisma.ledgerAccount.findMany({
      where: { purpose: 'PROVIDER_CLEARING' },
    });
    const platformAccounts = await prisma.ledgerAccount.findMany({
      where: { purpose: 'PLATFORM_COMMISSION' },
    });
    expect(new Set(systemAccounts.map((a) => `${a.ownerType}:${a.ownerId}`))).toEqual(
      new Set(['SYSTEM:LIT_BUY_SYSTEM']),
    );
    expect(new Set(platformAccounts.map((a) => `${a.ownerType}:${a.ownerId}`))).toEqual(
      new Set(['PLATFORM:LIT_BUY_PLATFORM']),
    );
    expect(Object.keys(await prisma.sellerProfile.findFirstOrThrow())).not.toContain('balance');
  });

  it('preserves order, payment, attempt, stock and reservations outside ledger effects', async () => {
    const { order, payment, attempt, fixture } = await activePaidOrder({
      fee: 1000n,
      quantity: 10,
    });
    const before = {
      order: await prisma.order.findUniqueOrThrow({ where: { id: order.id } }),
      reservations: await prisma.inventoryReservation.findMany({ where: { orderId: order.id } }),
      product: await prisma.product.findUniqueOrThrow({ where: { id: fixture.product.id } }),
      payment: await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } }),
      attempt: await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: attempt.id } }),
      settlements: await prisma.settlement.count(),
      holds: await prisma.financialHold.count(),
    };
    await recognition.processOne(order.id);
    expect(await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).toEqual(before.order);
    expect(await prisma.inventoryReservation.findMany({ where: { orderId: order.id } })).toEqual(
      before.reservations,
    );
    expect(await prisma.product.findUniqueOrThrow({ where: { id: fixture.product.id } })).toEqual(
      before.product,
    );
    expect(await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).toEqual(
      before.payment,
    );
    expect(await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: attempt.id } })).toEqual(
      before.attempt,
    );
    expect(await prisma.settlement.count()).toBe(before.settlements);
    expect(await prisma.financialHold.count()).toBe(before.holds);
    const entries = await entriesFor(order.id);
    expect(
      entries.some((entry) =>
        ['SELLER_HELD', 'SELLER_AVAILABLE', 'SELLER_RESERVED'].includes(entry.account.purpose),
      ),
    ).toBe(false);
    const source = readFileSync(
      join(__dirname, '../src/financial/sale-financial-recognition.service.ts'),
      'utf8',
    );
    expect(source).toContain('this.ledger.postWithOutcome(request)');
    expect(source).not.toContain('ledgerTransaction.create(');
    expect(source).not.toContain('ledgerEntry.create(');
    expect(source).not.toContain('PaymentProviderPort');
    expect(source).not.toContain('EfiPaymentProvider');
    expect(source).not.toContain('fetch(');
    expect(source).not.toContain('http');
  });
});
