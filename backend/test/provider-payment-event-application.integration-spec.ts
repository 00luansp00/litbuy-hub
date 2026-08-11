import { Test } from '@nestjs/testing';
import { DatabaseModule } from '../src/database/database.module';
import { PrismaService } from '../src/database/prisma.service';
import {
  PaymentProviderError,
  type PaymentProviderPort,
  type ProviderPayment,
} from '../src/financial/payment-provider.port';
import { ProviderWebhookEventProcessor } from '../src/financial/provider-webhook-event.processor';
import { commerceFixture } from './order-checkout-test.helpers';

class ControlledPaymentProvider implements PaymentProviderPort {
  readonly providerCode = 'EFI_BILLING';
  calls = 0;
  observed: ProviderPayment | null = null;
  failure?: PaymentProviderError;
  releases: Promise<void>[] = [Promise.resolve()];
  assertAvailable() {}
  createPayment() {
    return Promise.reject(new Error('mutation forbidden'));
  }
  async getPayment() {
    this.calls += 1;
    await (this.releases[this.calls - 1] ?? Promise.resolve());
    if (this.failure) throw this.failure;
    return this.observed;
  }
  cancelPayment() {
    return Promise.reject(new Error('mutation forbidden'));
  }
  refundPayment() {
    return Promise.reject(new Error('mutation forbidden'));
  }
}

describe('provider payment event application with real PostgreSQL', () => {
  jest.setTimeout(120_000);
  const provider = new ControlledPaymentProvider();
  let module: Awaited<ReturnType<ReturnType<typeof Test.createTestingModule>['compile']>>;
  let prisma: PrismaService;
  let processor: ProviderWebhookEventProcessor;
  let fixture: Awaited<ReturnType<typeof commerceFixture>>;

  beforeAll(async () => {
    module = await Test.createTestingModule({ imports: [DatabaseModule] }).compile();
    prisma = module.get(PrismaService);
    processor = new ProviderWebhookEventProcessor(prisma, [provider]);
  });
  beforeEach(async () => {
    await prisma.reconciliationIssue.deleteMany();
    await prisma.providerWebhookEvent.deleteMany();
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "User", "CatalogCategory" CASCADE');
    fixture = await commerceFixture(prisma);
    provider.calls = 0;
    provider.observed = null;
    provider.failure = undefined;
    provider.releases = [Promise.resolve()];
  });
  afterAll(() => module.close());

  async function scenario(
    status: 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'EXPIRED',
    options: {
      orderStatus?: 'PENDING_PAYMENT' | 'EXPIRED' | 'CANCELLED';
      occurredAt?: Date | null;
      reservationStatus?: 'ACTIVE' | 'RELEASED' | 'EXPIRED';
      externalPaymentId?: string;
      paymentStatus?: 'PENDING' | 'PAID';
      paidAt?: Date | null;
      attemptStatus?: 'PENDING' | 'SUCCEEDED';
      providerCode?: string;
    } = {},
  ) {
    const cart = await prisma.cart.create({
      data: {
        buyerUserId: fixture.buyer.id,
        sellerProfileId: fixture.seller.id,
        status: 'CHECKED_OUT',
        checkedOutAt: new Date(),
      },
    });
    const expiresAt = new Date('2026-08-03T12:30:00.000Z');
    const order = await prisma.order.create({
      data: {
        publicCode: `EVENT-${crypto.randomUUID()}`,
        sourceCartId: cart.id,
        sourceCartVersion: 1,
        buyerUserId: fixture.buyer.id,
        sellerProfileId: fixture.seller.id,
        subtotalAmountMinor: 1_000n,
        totalAmountMinor: 1_000n,
        paymentStatus: 'PENDING',
        status: options.orderStatus ?? 'PENDING_PAYMENT',
        expiresAt,
      },
    });
    const variant = fixture.product.variants[0];
    const item = await prisma.orderItem.create({
      data: {
        orderId: order.id,
        sourceProductId: fixture.product.id,
        sourceProductVersion: fixture.product.version,
        sourceProductVariantId: variant.id,
        sellerProfileId: fixture.seller.id,
        sellerStoreName: fixture.seller.storeName,
        sellerSlug: fixture.seller.slug,
        productSlug: fixture.product.slug,
        productTitle: fixture.product.title,
        variantTitle: variant.title,
        productType: fixture.product.productType,
        productModel: fixture.product.model,
        deliveryMode: fixture.product.deliveryMode,
        unitAmountMinor: 1_000n,
        quantity: 1,
        lineTotalAmountMinor: 1_000n,
      },
    });
    const reservation = await prisma.inventoryReservation.create({
      data: {
        orderId: order.id,
        orderItemId: item.id,
        productId: fixture.product.id,
        productVariantId: variant.id,
        quantity: 1,
        expiresAt,
        status: options.reservationStatus ?? 'ACTIVE',
      },
    });
    const payment = await prisma.payment.create({
      data: {
        orderId: order.id,
        amountMinor: 1_000n,
        status: options.paymentStatus ?? 'PENDING',
        paidAt: options.paidAt,
      },
    });
    const externalPaymentId = options.externalPaymentId ?? `charge-${crypto.randomUUID()}`;
    const attempt = await prisma.paymentAttempt.create({
      data: {
        paymentId: payment.id,
        attemptNumber: 1,
        providerCode: options.providerCode ?? provider.providerCode,
        status: options.attemptStatus ?? 'PENDING',
        amountMinor: 1_000n,
        externalPaymentId,
        idempotencyKeyHash: crypto.randomUUID(),
        requestHash: crypto.randomUUID(),
      },
    });
    const event = await prisma.providerWebhookEvent.create({
      data: {
        providerCode: options.providerCode ?? provider.providerCode,
        externalEventId: crypto.randomUUID(),
        eventType: 'PAYMENT_STATUS_CHANGED',
        externalPaymentId,
        normalizedPaymentStatus: status,
        payloadHash: crypto.randomUUID(),
        occurredAt:
          options.occurredAt === undefined
            ? new Date('2026-08-03T12:00:00.000Z')
            : options.occurredAt,
      },
    });
    return { order, reservation, payment, attempt, event, externalPaymentId };
  }

  async function financialCounts() {
    return Promise.all([
      prisma.ledgerTransaction.count(),
      prisma.ledgerEntry.count(),
      prisma.settlement.count(),
      prisma.financialHold.count(),
    ]);
  }

  async function waitForProviderCall() {
    for (let index = 0; index < 100 && provider.calls === 0; index += 1)
      await new Promise((resolve) => setTimeout(resolve, 10));
    expect(provider.calls).toBe(1);
  }

  async function forceRetry(eventId: string, attempts?: number) {
    await prisma.providerWebhookEvent.update({
      where: { id: eventId },
      data: { availableAt: new Date(0), ...(attempts === undefined ? {} : { attempts }) },
    });
  }

  it('processes PENDING without provider IO or any financial effect', async () => {
    const created = await scenario('PENDING');
    await processor.processOne();
    expect(provider.calls).toBe(0);
    expect(
      await prisma.providerWebhookEvent.findUniqueOrThrow({ where: { id: created.event.id } }),
    ).toMatchObject({ status: 'PROCESSED', attempts: 1 });
    expect(
      await prisma.payment.findUniqueOrThrow({ where: { id: created.payment.id } }),
    ).toMatchObject({ status: 'PENDING', paidAt: null });
  });

  it('atomically confirms success while leaving Order, inventory and accounting untouched', async () => {
    const created = await scenario('SUCCEEDED');
    provider.observed = {
      id: created.externalPaymentId,
      status: 'SUCCEEDED',
      money: { amountMinor: 1_000n, currency: 'BRL' },
    };
    const accountingBefore = await financialCounts();
    await processor.processOne();
    expect(
      await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: created.attempt.id } }),
    ).toMatchObject({ status: 'SUCCEEDED' });
    expect(
      await prisma.payment.findUniqueOrThrow({ where: { id: created.payment.id } }),
    ).toMatchObject({ status: 'PAID', paidAt: new Date('2026-08-03T12:00:00.000Z') });
    expect(await prisma.order.findUniqueOrThrow({ where: { id: created.order.id } })).toMatchObject(
      { status: 'PENDING_PAYMENT', paymentStatus: 'PENDING' },
    );
    expect(
      await prisma.inventoryReservation.findUniqueOrThrow({
        where: { id: created.reservation.id },
      }),
    ).toMatchObject({ status: 'ACTIVE', consumedAt: null });
    expect(await financialCounts()).toEqual(accountingBefore);
    expect(
      await prisma.providerWebhookEvent.findUniqueOrThrow({ where: { id: created.event.id } }),
    ).toMatchObject({ status: 'PROCESSED' });
    expect(await processor.processOne()).toBe(false);
    expect(provider.calls).toBe(1);
  });

  it('claims only the requested durable event even when unrelated events are older', async () => {
    const unrelated = [];
    for (let index = 0; index < 26; index += 1) unrelated.push(await scenario('PENDING'));
    const target = await scenario('SUCCEEDED');
    provider.observed = {
      id: target.externalPaymentId,
      status: 'SUCCEEDED',
      money: { amountMinor: 1_000n, currency: 'BRL' },
    };

    await expect(processor.processOne(target.event.id)).resolves.toBe(true);

    expect(
      await prisma.providerWebhookEvent.findUniqueOrThrow({ where: { id: target.event.id } }),
    ).toMatchObject({ status: 'PROCESSED', attempts: 1 });
    for (const item of unrelated)
      expect(
        await prisma.providerWebhookEvent.findUniqueOrThrow({ where: { id: item.event.id } }),
      ).toMatchObject({ status: 'RECEIVED', attempts: 0 });
    expect(
      await prisma.payment.findUniqueOrThrow({ where: { id: target.payment.id } }),
    ).toMatchObject({ status: 'PAID' });
  });

  it('reconciles an amount mismatch without false success', async () => {
    const created = await scenario('SUCCEEDED');
    provider.observed = {
      id: created.externalPaymentId,
      status: 'SUCCEEDED',
      money: { amountMinor: 999n, currency: 'BRL' },
    };
    await processor.processOne();
    expect(await prisma.reconciliationIssue.findFirstOrThrow()).toMatchObject({
      type: 'AMOUNT_MISMATCH',
      expectedAmountMinor: 1_000n,
      observedAmountMinor: 999n,
    });
    expect(
      await prisma.payment.findUniqueOrThrow({ where: { id: created.payment.id } }),
    ).toMatchObject({ status: 'PENDING' });
  });

  it.each([
    ['FAILED', 'FAILED'],
    ['EXPIRED', 'EXPIRED'],
  ] as const)('applies confirmed %s only to the attempt', async (eventStatus, providerStatus) => {
    const created = await scenario(eventStatus);
    provider.observed = {
      id: created.externalPaymentId,
      status: providerStatus,
      money: { amountMinor: 1_000n, currency: 'BRL' },
    };
    await processor.processOne();
    expect(
      await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: created.attempt.id } }),
    ).toMatchObject({ status: eventStatus });
    expect(
      await prisma.payment.findUniqueOrThrow({ where: { id: created.payment.id } }),
    ).toMatchObject({ status: 'PENDING' });
  });

  it('ignores an old failure when the provider is already successful', async () => {
    const created = await scenario('FAILED');
    provider.observed = {
      id: created.externalPaymentId,
      status: 'SUCCEEDED',
      money: { amountMinor: 1_000n, currency: 'BRL' },
    };
    await processor.processOne();
    expect(
      await prisma.providerWebhookEvent.findUniqueOrThrow({ where: { id: created.event.id } }),
    ).toMatchObject({ status: 'IGNORED', lastErrorCode: 'STALE_PROVIDER_EVENT' });
    expect(
      await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: created.attempt.id } }),
    ).toMatchObject({ status: 'PENDING' });
  });

  it('bounds missing-local and safe-read retries without inventing payment state', async () => {
    const created = await scenario('SUCCEEDED');
    await prisma.paymentAttempt.delete({ where: { id: created.attempt.id } });
    await processor.processOne();
    expect(
      await prisma.providerWebhookEvent.findUniqueOrThrow({ where: { id: created.event.id } }),
    ).toMatchObject({ status: 'FAILED', attempts: 1, lastErrorCode: 'MISSING_LOCAL' });
    await prisma.providerWebhookEvent.update({
      where: { id: created.event.id },
      data: {
        attempts: 2,
        availableAt: new Date(0),
      },
    });
    await processor.processOne();
    expect(await prisma.reconciliationIssue.findFirstOrThrow()).toMatchObject({
      type: 'MISSING_LOCAL',
    });
    expect(
      await prisma.providerWebhookEvent.findUniqueOrThrow({ where: { id: created.event.id } }),
    ).toMatchObject({ status: 'IGNORED', attempts: 3 });
  });

  it.each([['EXPIRED'], ['CANCELLED']] as const)(
    'records confirmed late payment for an %s Order without reactivation',
    async (orderStatus) => {
      const created = await scenario('SUCCEEDED', { orderStatus, reservationStatus: 'RELEASED' });
      provider.observed = {
        id: created.externalPaymentId,
        status: 'SUCCEEDED',
        money: { amountMinor: 1_000n, currency: 'BRL' },
      };
      const accountingBefore = await financialCounts();
      await processor.processOne();
      expect(
        await prisma.payment.findUniqueOrThrow({ where: { id: created.payment.id } }),
      ).toMatchObject({ status: 'PAID' });
      expect(
        await prisma.order.findUniqueOrThrow({ where: { id: created.order.id } }),
      ).toMatchObject({ status: orderStatus });
      expect(await prisma.reconciliationIssue.findFirstOrThrow()).toMatchObject({
        type: 'LATE_PAYMENT',
      });
      expect(
        await prisma.inventoryReservation.findUniqueOrThrow({
          where: { id: created.reservation.id },
        }),
      ).toEqual(created.reservation);
      expect(await prisma.reconciliationIssue.count({ where: { type: 'LATE_PAYMENT' } })).toBe(1);
      expect(await financialCounts()).toEqual(accountingBefore);
    },
  );

  it('fails closed when a PAID Payment has no paidAt', async () => {
    const created = await scenario('SUCCEEDED', { paymentStatus: 'PAID', paidAt: null });
    provider.observed = {
      id: created.externalPaymentId,
      status: 'SUCCEEDED',
      money: { amountMinor: 1_000n, currency: 'BRL' },
    };
    const before = await financialCounts();
    await processor.processOne();
    expect(
      await prisma.payment.findUniqueOrThrow({ where: { id: created.payment.id } }),
    ).toMatchObject({ status: 'PAID', paidAt: null });
    expect(
      await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: created.attempt.id } }),
    ).toMatchObject({ status: 'PENDING' });
    expect(await prisma.reconciliationIssue.count()).toBe(1);
    expect(await prisma.reconciliationIssue.findFirstOrThrow()).toMatchObject({
      type: 'STATUS_MISMATCH',
      details: expect.objectContaining({ errorCode: 'PAID_AT_MISSING' }),
    });
    expect(
      await prisma.providerWebhookEvent.findUniqueOrThrow({ where: { id: created.event.id } }),
    ).toMatchObject({ status: 'IGNORED', lastErrorCode: 'PAID_AT_MISSING' });
    expect(await financialCounts()).toEqual(before);
  });

  it('allows only one concurrent worker to claim and apply an event', async () => {
    const created = await scenario('SUCCEEDED');
    let release!: () => void;
    provider.releases = [new Promise<void>((resolve) => (release = resolve))];
    provider.observed = {
      id: created.externalPaymentId,
      status: 'SUCCEEDED',
      money: { amountMinor: 1_000n, currency: 'BRL' },
    };
    const workerA = processor.processOne();
    await waitForProviderCall();
    await expect(processor.processOne()).resolves.toBe(false);
    release();
    await expect(workerA).resolves.toBe(true);
    expect(provider.calls).toBe(1);
    expect(
      await prisma.providerWebhookEvent.findUniqueOrThrow({ where: { id: created.event.id } }),
    ).toMatchObject({ attempts: 1, status: 'PROCESSED' });
    expect(
      await prisma.payment.findUniqueOrThrow({ where: { id: created.payment.id } }),
    ).toMatchObject({ status: 'PAID' });
  });

  it('fences a stale worker by the attempts generation', async () => {
    const created = await scenario('SUCCEEDED');
    let releaseA!: () => void;
    provider.releases = [new Promise<void>((resolve) => (releaseA = resolve)), Promise.resolve()];
    provider.observed = {
      id: created.externalPaymentId,
      status: 'SUCCEEDED',
      money: { amountMinor: 1_000n, currency: 'BRL' },
    };
    const workerA = processor.processOne();
    await waitForProviderCall();
    await prisma.providerWebhookEvent.update({
      where: { id: created.event.id },
      data: { processingStartedAt: new Date(0) },
    });
    await expect(processor.processOne()).resolves.toBe(true);
    const afterB = {
      event: await prisma.providerWebhookEvent.findUniqueOrThrow({
        where: { id: created.event.id },
      }),
      attempt: await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: created.attempt.id } }),
      payment: await prisma.payment.findUniqueOrThrow({ where: { id: created.payment.id } }),
      issues: await prisma.reconciliationIssue.count(),
    };
    expect(afterB.event).toMatchObject({ attempts: 2, status: 'PROCESSED' });
    releaseA();
    await workerA;
    expect(
      await prisma.providerWebhookEvent.findUniqueOrThrow({ where: { id: created.event.id } }),
    ).toEqual(afterB.event);
    expect(
      await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: created.attempt.id } }),
    ).toEqual(afterB.attempt);
    expect(await prisma.payment.findUniqueOrThrow({ where: { id: created.payment.id } })).toEqual(
      afterB.payment,
    );
    expect(await prisma.reconciliationIssue.count()).toBe(afterB.issues);
  });

  it('reconciles currency mismatch without false success', async () => {
    const created = await scenario('SUCCEEDED');
    provider.observed = {
      id: created.externalPaymentId,
      status: 'SUCCEEDED',
      money: { amountMinor: 1_000n, currency: 'USD' as 'BRL' },
    };
    await processor.processOne();
    expect(await prisma.reconciliationIssue.findFirstOrThrow()).toMatchObject({
      details: expect.objectContaining({ errorCode: 'CURRENCY_MISMATCH' }),
    });
    expect(
      await prisma.payment.findUniqueOrThrow({ where: { id: created.payment.id } }),
    ).toMatchObject({ status: 'PENDING' });
    expect(
      await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: created.attempt.id } }),
    ).toMatchObject({ status: 'PENDING' });
  });

  it('retries provider PENDING and later applies SUCCEEDED exactly once', async () => {
    const created = await scenario('SUCCEEDED');
    provider.observed = {
      id: created.externalPaymentId,
      status: 'PENDING',
      money: { amountMinor: 1_000n, currency: 'BRL' },
    };
    await processor.processOne();
    expect(await prisma.reconciliationIssue.count()).toBe(0);
    expect(
      await prisma.providerWebhookEvent.findUniqueOrThrow({ where: { id: created.event.id } }),
    ).toMatchObject({ status: 'FAILED', lastErrorCode: 'PROVIDER_PENDING' });
    await forceRetry(created.event.id);
    provider.observed = { ...provider.observed, status: 'SUCCEEDED' };
    await processor.processOne();
    expect(
      await prisma.payment.findUniqueOrThrow({ where: { id: created.payment.id } }),
    ).toMatchObject({ status: 'PAID' });
    expect(await processor.processOne()).toBe(false);
    expect(provider.calls).toBe(2);
  });

  it('reconciles provider PENDING at the retry limit', async () => {
    const created = await scenario('SUCCEEDED');
    provider.observed = {
      id: created.externalPaymentId,
      status: 'PENDING',
      money: { amountMinor: 1_000n, currency: 'BRL' },
    };
    await forceRetry(created.event.id, 2);
    await processor.processOne();
    expect(await prisma.reconciliationIssue.findFirstOrThrow()).toMatchObject({
      type: 'STATUS_MISMATCH',
    });
    expect(
      await prisma.providerWebhookEvent.findUniqueOrThrow({ where: { id: created.event.id } }),
    ).toMatchObject({ status: 'IGNORED', attempts: 3 });
    expect(
      await prisma.payment.findUniqueOrThrow({ where: { id: created.payment.id } }),
    ).toMatchObject({ status: 'PENDING' });
  });

  it.each(['FAILED', 'EXPIRED'] as const)(
    'reconciles SUCCEEDED event with provider %s',
    async (status) => {
      const created = await scenario('SUCCEEDED');
      provider.observed = {
        id: created.externalPaymentId,
        status,
        money: { amountMinor: 1_000n, currency: 'BRL' },
      };
      await processor.processOne();
      expect(await prisma.reconciliationIssue.findFirstOrThrow()).toMatchObject({
        type: 'STATUS_MISMATCH',
      });
      expect(
        await prisma.payment.findUniqueOrThrow({ where: { id: created.payment.id } }),
      ).toMatchObject({ status: 'PENDING' });
    },
  );

  it('reconciles an ambiguous provider read without false success', async () => {
    const created = await scenario('SUCCEEDED');
    provider.failure = new PaymentProviderError('AMBIGUOUS', 'AMBIGUOUS_PROVIDER_READ');
    await processor.processOne();
    expect(provider.calls).toBe(1);
    expect(await prisma.reconciliationIssue.count()).toBe(1);
    expect(
      await prisma.providerWebhookEvent.findUniqueOrThrow({ where: { id: created.event.id } }),
    ).toMatchObject({ status: 'IGNORED' });
    expect(
      await prisma.payment.findUniqueOrThrow({ where: { id: created.payment.id } }),
    ).toMatchObject({ status: 'PENDING' });
    expect(
      await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: created.attempt.id } }),
    ).toMatchObject({ status: 'PENDING' });
  });

  it('reconciles a second successful attempt for the same Payment', async () => {
    const created = await scenario('SUCCEEDED');
    await prisma.paymentAttempt.create({
      data: {
        paymentId: created.payment.id,
        attemptNumber: 2,
        providerCode: provider.providerCode,
        status: 'SUCCEEDED',
        amountMinor: 1_000n,
        externalPaymentId: `other-${crypto.randomUUID()}`,
        idempotencyKeyHash: crypto.randomUUID(),
        requestHash: crypto.randomUUID(),
      },
    });
    provider.observed = {
      id: created.externalPaymentId,
      status: 'SUCCEEDED',
      money: { amountMinor: 1_000n, currency: 'BRL' },
    };
    await processor.processOne();
    expect(await prisma.reconciliationIssue.findFirstOrThrow()).toMatchObject({
      details: expect.objectContaining({ errorCode: 'MULTIPLE_SUCCEEDED_ATTEMPTS' }),
    });
    expect(
      await prisma.payment.findUniqueOrThrow({ where: { id: created.payment.id } }),
    ).toMatchObject({ status: 'PENDING' });
  });

  it.each([
    ['paid after expiry', { occurredAt: new Date('2026-08-03T13:00:00.000Z') }],
    ['released reservation', { reservationStatus: 'RELEASED' as const }],
    ['expired reservation', { reservationStatus: 'EXPIRED' as const }],
  ])(
    'records one late payment for %s without changing order, inventory, or accounting',
    async (_name, options) => {
      const created = await scenario('SUCCEEDED', options);
      provider.observed = {
        id: created.externalPaymentId,
        status: 'SUCCEEDED',
        money: { amountMinor: 1_000n, currency: 'BRL' },
      };
      const accountingBefore = await financialCounts();
      await processor.processOne();
      expect(
        await prisma.payment.findUniqueOrThrow({ where: { id: created.payment.id } }),
      ).toMatchObject({ status: 'PAID' });
      expect(await prisma.order.findUniqueOrThrow({ where: { id: created.order.id } })).toEqual(
        created.order,
      );
      expect(
        await prisma.inventoryReservation.findUniqueOrThrow({
          where: { id: created.reservation.id },
        }),
      ).toEqual(created.reservation);
      expect(await prisma.reconciliationIssue.count({ where: { type: 'LATE_PAYMENT' } })).toBe(1);
      expect(await financialCounts()).toEqual(accountingBefore);
    },
  );

  it('reconciles an unconfigured provider without adapter IO', async () => {
    const created = await scenario('SUCCEEDED', { providerCode: 'UNKNOWN' });
    await processor.processOne();
    expect(provider.calls).toBe(0);
    expect(await prisma.reconciliationIssue.count()).toBe(1);
    expect(
      await prisma.payment.findUniqueOrThrow({ where: { id: created.payment.id } }),
    ).toMatchObject({ status: 'PENDING' });
  });

  it.each([
    ['a missing provider payment', null, 'MISSING_PROVIDER'],
    ['a mismatched provider identity', 'different-id', 'STATUS_MISMATCH'],
  ] as const)('reconciles %s', async (_name, providerId, issueType) => {
    const created = await scenario('SUCCEEDED');
    provider.observed =
      providerId === null
        ? null
        : { id: providerId, status: 'SUCCEEDED', money: { amountMinor: 1_000n, currency: 'BRL' } };
    await processor.processOne();
    expect(await prisma.reconciliationIssue.findFirstOrThrow()).toMatchObject({ type: issueType });
    expect(
      await prisma.payment.findUniqueOrThrow({ where: { id: created.payment.id } }),
    ).toMatchObject({ status: 'PENDING' });
  });

  it('does not apply a processed event twice', async () => {
    const created = await scenario('SUCCEEDED');
    provider.observed = {
      id: created.externalPaymentId,
      status: 'SUCCEEDED',
      money: { amountMinor: 1_000n, currency: 'BRL' },
    };
    await processor.processOne();
    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: created.payment.id } });
    await expect(processor.processOne()).resolves.toBe(false);
    expect(provider.calls).toBe(1);
    expect(await prisma.payment.findUniqueOrThrow({ where: { id: created.payment.id } })).toEqual(
      payment,
    );
  });

  it('rolls back final local mutations and permits a later retry', async () => {
    const created = await scenario('SUCCEEDED');
    provider.observed = {
      id: created.externalPaymentId,
      status: 'SUCCEEDED',
      money: { amountMinor: 1_000n, currency: 'BRL' },
    };
    await prisma.$executeRawUnsafe(
      `CREATE OR REPLACE FUNCTION fail_payment_update() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'injected final transaction failure'; END; $$ LANGUAGE plpgsql`,
    );
    await prisma.$executeRawUnsafe(
      `CREATE TRIGGER fail_payment_update BEFORE UPDATE ON "Payment" FOR EACH ROW EXECUTE FUNCTION fail_payment_update()`,
    );
    try {
      await expect(processor.processOne()).rejects.toThrow('injected final transaction failure');
    } finally {
      await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS fail_payment_update ON "Payment"`);
      await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS fail_payment_update()`);
    }
    expect(
      await prisma.payment.findUniqueOrThrow({ where: { id: created.payment.id } }),
    ).toMatchObject({ status: 'PENDING' });
    expect(
      await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: created.attempt.id } }),
    ).toMatchObject({ status: 'PENDING' });
    expect(
      await prisma.providerWebhookEvent.findUniqueOrThrow({ where: { id: created.event.id } }),
    ).toMatchObject({ status: 'PROCESSING' });
    await prisma.providerWebhookEvent.update({
      where: { id: created.event.id },
      data: { processingStartedAt: new Date(0) },
    });
    await processor.processOne();
    expect(
      await prisma.payment.findUniqueOrThrow({ where: { id: created.payment.id } }),
    ).toMatchObject({ status: 'PAID' });
    expect(
      await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: created.attempt.id } }),
    ).toMatchObject({ status: 'SUCCEEDED' });
    expect(provider.calls).toBe(2);
  });

  it('keeps a safe provider read failure recoverable', async () => {
    const created = await scenario('SUCCEEDED');
    provider.failure = new PaymentProviderError('SAFE_TO_RETRY', 'PROVIDER_UNAVAILABLE');
    await processor.processOne();
    expect(
      await prisma.providerWebhookEvent.findUniqueOrThrow({ where: { id: created.event.id } }),
    ).toMatchObject({ status: 'FAILED', lastErrorCode: 'PROVIDER_UNAVAILABLE' });
    expect(
      await prisma.payment.findUniqueOrThrow({ where: { id: created.payment.id } }),
    ).toMatchObject({ status: 'PENDING' });
  });
});
