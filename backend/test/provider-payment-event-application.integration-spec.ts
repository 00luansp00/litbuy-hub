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
  release: Promise<void> = Promise.resolve();
  assertAvailable() {}
  createPayment() {
    return Promise.reject(new Error('mutation forbidden'));
  }
  async getPayment() {
    this.calls += 1;
    await this.release;
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
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "User", "CatalogCategory" CASCADE');
    fixture = await commerceFixture(prisma);
    provider.calls = 0;
    provider.observed = null;
    provider.failure = undefined;
    provider.release = Promise.resolve();
  });
  afterAll(() => module.close());

  async function scenario(
    status: 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'EXPIRED',
    options: {
      orderStatus?: 'PENDING_PAYMENT' | 'EXPIRED' | 'CANCELLED';
      occurredAt?: Date | null;
      reservationStatus?: 'ACTIVE' | 'RELEASED' | 'EXPIRED';
      externalPaymentId?: string;
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
      },
    });
    const externalPaymentId = options.externalPaymentId ?? `charge-${crypto.randomUUID()}`;
    const attempt = await prisma.paymentAttempt.create({
      data: {
        paymentId: payment.id,
        attemptNumber: 1,
        providerCode: provider.providerCode,
        status: 'PENDING',
        amountMinor: 1_000n,
        externalPaymentId,
        idempotencyKeyHash: crypto.randomUUID(),
        requestHash: crypto.randomUUID(),
      },
    });
    const event = await prisma.providerWebhookEvent.create({
      data: {
        providerCode: provider.providerCode,
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
    expect(
      await Promise.all([
        prisma.ledgerTransaction.count(),
        prisma.ledgerEntry.count(),
        prisma.settlement.count(),
        prisma.financialHold.count(),
      ]),
    ).toEqual([0, 0, 0, 0]);
    expect(
      await prisma.providerWebhookEvent.findUniqueOrThrow({ where: { id: created.event.id } }),
    ).toMatchObject({ status: 'PROCESSED' });
    expect(await processor.processOne()).toBe(false);
    expect(provider.calls).toBe(1);
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
    },
  );

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
