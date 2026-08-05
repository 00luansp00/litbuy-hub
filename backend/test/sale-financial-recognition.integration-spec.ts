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

describe('SaleFinancialRecognitionService with real PostgreSQL', () => {
  jest.setTimeout(120_000);
  let app: Awaited<ReturnType<ReturnType<typeof Test.createTestingModule>['compile']>>;
  let prisma: PrismaService;
  let carts: CartsService;
  let checkout: CheckoutService;
  let activation: PaidOrderActivationService;
  let recognition: SaleFinancialRecognitionService;
  let ledger: FinancialLedgerService;

  beforeAll(async () => {
    app = await Test.createTestingModule({ imports: [AppModule] }).compile();
    prisma = app.get(PrismaService);
    carts = app.get(CartsService);
    checkout = app.get(CheckoutService);
    activation = app.get(PaidOrderActivationService);
    recognition = app.get(SaleFinancialRecognitionService);
    ledger = app.get(FinancialLedgerService);
  });
  beforeEach(() => prisma.$executeRawUnsafe('TRUNCATE TABLE "User", "CatalogCategory" CASCADE'));
  afterAll(() => app.close());

  async function activePaidOrder(fee = 1000n) {
    const fixture = await commerceFixture(prisma, 'NORMAL', undefined, 5, false);
    await publishPlatformCommissionPolicy(prisma, fixture.sellerUser.id, { fixedAmountMinor: fee });
    const preview = await carts.add(fixture.buyer.id, fixture.seller.slug, {
      productId: fixture.product.id,
      quantity: 1,
      expectedVersion: 0,
    });
    const response = await checkout.create(
      fixture.buyer.id,
      parseIdempotencyKey(`sale-recognition:${crypto.randomUUID()}`),
      {
        sellerSlug: fixture.seller.slug,
        expectedCartVersion: preview.version,
        expectedPreviewFingerprint: preview.previewFingerprint,
      },
    );
    const order = await prisma.order.findUniqueOrThrow({
      where: { publicCode: (response as { orderCode: string }).orderCode },
      include: { reservations: true },
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
    await prisma.paymentAttempt.create({
      data: {
        paymentId: payment.id,
        attemptNumber: 1,
        providerCode: 'LOCAL_TEST',
        status: 'SUCCEEDED',
        amountMinor: payment.amountMinor,
        currency: 'BRL',
        externalPaymentId: `pay-${crypto.randomUUID()}`,
        idempotencyKeyHash: crypto.randomUUID(),
        requestHash: crypto.randomUUID(),
      },
    });
    await prisma.order.update({ where: { id: order.id }, data: { paymentStatus: 'PENDING' } });
    await activation.processOne(order.id);
    return {
      fixture,
      order: await prisma.order.findUniqueOrThrow({
        where: { id: order.id },
        include: { reservations: true },
      }),
      payment,
    };
  }

  it('posts the sale once using the immutable order snapshot and leaves seller funds pending', async () => {
    const { fixture, order } = await activePaidOrder(1000n);
    await Promise.all(Array.from({ length: 6 }, () => recognition.processOne(order.id)));
    await recognition.processBatch(10);

    const txs = await prisma.ledgerTransaction.findMany({
      where: { type: 'SALE_RECOGNIZED', referenceType: 'OrderSale', referenceId: order.id },
      include: { entries: { include: { account: true } } },
    });
    expect(txs).toHaveLength(1);
    expect(txs[0].metadata).toMatchObject({
      grossAmountMinor: '1000',
      platformCommissionMinor: '1000',
      sellerProceedsMinor: '0',
    });
    const entries = txs[0].entries.map((entry) => ({
      purpose: entry.account.purpose,
      ownerType: entry.account.ownerType,
      direction: entry.direction,
      amount: entry.amountMinor,
    }));
    expect(entries).toEqual(
      expect.arrayContaining([
        { purpose: 'PROVIDER_CLEARING', ownerType: 'SYSTEM', direction: 'DEBIT', amount: 1000n },
        {
          purpose: 'PLATFORM_COMMISSION',
          ownerType: 'PLATFORM',
          direction: 'CREDIT',
          amount: 1000n,
        },
      ]),
    );
    expect(entries.some((entry) => entry.purpose === 'SELLER_PENDING')).toBe(false);
    expect(
      await prisma.financialEvent.count({
        where: { ledgerTransactionId: txs[0].id, type: 'SALE_RECOGNIZED' },
      }),
    ).toBe(1);
    expect(
      await prisma.financialOutboxEvent.count({ where: { eventType: 'SALE_RECOGNIZED' } }),
    ).toBe(1);
    expect(await ledger.getSellerFinancialBalance(fixture.seller.id)).toMatchObject({
      pending: 0n,
      held: 0n,
      available: 0n,
      reserved: 0n,
    });
  });

  it('omits zero commission entries and credits seller pending', async () => {
    const { fixture, order } = await activePaidOrder(0n);
    await recognition.processOne(order.id);
    const balance = await ledger.getSellerFinancialBalance(fixture.seller.id);
    expect(balance).toMatchObject({ pending: 1000n, held: 0n, available: 0n, reserved: 0n });
    const entries = await prisma.ledgerEntry.findMany({
      where: { transaction: { referenceId: order.id } },
      include: { account: true },
    });
    expect(entries.some((entry) => entry.amountMinor === 0n)).toBe(false);
    expect(entries.some((entry) => entry.account.purpose === 'PLATFORM_COMMISSION')).toBe(false);
  });

  it('fails closed for legacy snapshots and does not call PSP or direct Prisma posting paths', async () => {
    const source = readFileSync(
      join(__dirname, '../src/financial/sale-financial-recognition.service.ts'),
      'utf8',
    );
    expect(source).toContain('this.ledger.post(request)');
    expect(source).not.toContain('ledgerTransaction.create(');
    expect(source).not.toContain('ledgerEntry.create(');
    expect(source).not.toContain('PaymentProviderPort');
    expect(source).not.toContain('EfiPaymentProvider');
    expect(source).not.toContain('http');

    const fixture = await commerceFixture(prisma, 'NORMAL', undefined, 5, false);
    const cart = await prisma.cart.create({
      data: { buyerUserId: fixture.buyer.id, sellerProfileId: fixture.seller.id },
    });
    const order = await prisma.order.create({
      data: {
        publicCode: `legacy-${crypto.randomUUID()}`,
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
        externalPaymentId: `pay-${crypto.randomUUID()}`,
        idempotencyKeyHash: crypto.randomUUID(),
        requestHash: crypto.randomUUID(),
      },
    });

    await recognition.processOne(order.id);
    expect(
      await prisma.ledgerTransaction.count({
        where: { type: 'SALE_RECOGNIZED', referenceId: order.id },
      }),
    ).toBe(0);
    expect(
      await prisma.reconciliationIssue.findFirst({
        where: { referenceType: 'SaleFinancialRecognition', referenceId: order.id, status: 'OPEN' },
      }),
    ).toMatchObject({ details: { errorCode: 'ORDER_PRICING_SNAPSHOT_MISSING' } });
  });
});
