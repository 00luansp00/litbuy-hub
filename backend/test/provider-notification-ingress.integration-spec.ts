import { createSecretKey } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { DatabaseModule } from '../src/database/database.module';
import { PrismaService } from '../src/database/prisma.service';
import {
  PaymentProviderError,
  type PaymentProviderNotificationPort,
  type ProviderWebhook,
} from '../src/financial/payment-provider.port';
import { ProviderNotificationInboxWorker } from '../src/financial/provider-notification-inbox.worker';
import { ProviderNotificationIngressService } from '../src/financial/provider-notification-ingress.service';
import { ProviderNotificationProtector } from '../src/financial/provider-notification-protector';
import { commerceFixture } from './order-checkout-test.helpers';

class ControlledNotificationProvider implements PaymentProviderNotificationPort {
  readonly providerCode = 'EFI_BILLING';
  calls = 0;
  failure?: PaymentProviderError;
  events: ProviderWebhook[] = [];
  release: Promise<void> = Promise.resolve();
  handler?: (call: number) => Promise<ProviderWebhook[]>;
  assertAvailable() {}
  async resolveNotification() {
    this.calls += 1;
    if (this.handler) return this.handler(this.calls);
    await this.release;
    if (this.failure) throw this.failure;
    return this.events;
  }
}

describe('durable provider notification inbox with real PostgreSQL', () => {
  jest.setTimeout(120_000);
  const config = {
    efiBillingEnabled: true,
    keyId: 'integration-key-v1',
    key: createSecretKey(Buffer.alloc(32, 11)),
  };
  const provider = new ControlledNotificationProvider();
  const protector = new ProviderNotificationProtector(config);
  let module: Awaited<ReturnType<ReturnType<typeof Test.createTestingModule>['compile']>>;
  let prisma: PrismaService;
  let ingress: ProviderNotificationIngressService;
  let worker: ProviderNotificationInboxWorker;

  beforeAll(async () => {
    module = await Test.createTestingModule({ imports: [DatabaseModule] }).compile();
    prisma = module.get(PrismaService);
    ingress = new ProviderNotificationIngressService(prisma, protector, config);
    worker = new ProviderNotificationInboxWorker(prisma, protector, [provider]);
  });
  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "ProviderNotificationInbox", "ProviderWebhookEvent", "ReconciliationIssue" CASCADE',
    );
    provider.calls = 0;
    provider.failure = undefined;
    provider.events = [];
    provider.release = Promise.resolve();
    provider.handler = undefined;
  });
  afterAll(() => module.close());

  it('commits every callback delivery with recoverable protected material', async () => {
    const token = 'same_token_lifecycle_123';
    await ingress.acceptEfiBilling(token);
    await ingress.acceptEfiBilling(token);
    const deliveries = await prisma.providerNotificationInbox.findMany();
    expect(deliveries).toHaveLength(2);
    expect(JSON.stringify(deliveries)).not.toContain(token);
    expect(protector.recover(deliveries[0])).toBe(token);
    expect(provider.calls).toBe(0);
  });

  it('claims concurrently only once and performs provider IO after the claim commit', async () => {
    await ingress.acceptEfiBilling('concurrent_token_123');
    let release!: () => void;
    provider.release = new Promise<void>((resolve) => (release = resolve));
    provider.events = [event()];
    const first = worker.processOne();
    while (provider.calls === 0) await new Promise((resolve) => setTimeout(resolve, 5));
    const claimed = await prisma.providerNotificationInbox.findFirstOrThrow();
    expect(claimed.status).toBe('PROCESSING');
    expect(claimed.attempts).toBe(1);
    expect(await worker.processOne()).toBe(false);
    release();
    await first;
    expect(provider.calls).toBe(1);
    expect((await prisma.providerNotificationInbox.findFirstOrThrow()).status).toBe('PROCESSED');
  });

  it('atomically persists normalized correlation and deduplicates redelivery', async () => {
    const normalized = event();
    provider.events = [normalized];
    await ingress.acceptEfiBilling('delivery_token_123');
    await worker.processOne();
    await ingress.acceptEfiBilling('delivery_token_123');
    await worker.processOne();
    const persisted = await prisma.providerWebhookEvent.findMany();
    expect(persisted).toHaveLength(1);
    expect(persisted[0]).toMatchObject({
      externalPaymentId: normalized.paymentId,
      normalizedPaymentStatus: normalized.status,
      occurredAt: normalized.occurredAt,
    });
    expect(await prisma.providerNotificationInbox.count({ where: { status: 'PROCESSED' } })).toBe(
      2,
    );
  });

  it('fails closed and reconciles incompatible reuse of an external event identity', async () => {
    const normalized = event();
    provider.events = [normalized];
    await ingress.acceptEfiBilling('first_delivery_123');
    await worker.processOne();
    provider.events = [{ ...normalized, status: 'FAILED', payloadHash: 'b'.repeat(64) }];
    await ingress.acceptEfiBilling('second_delivery_123');
    await worker.processOne();
    expect(await prisma.providerWebhookEvent.count()).toBe(1);
    expect((await prisma.providerWebhookEvent.findFirstOrThrow()).status).toBe('RECEIVED');
    expect(
      (await prisma.providerNotificationInbox.findFirstOrThrow({ orderBy: { receivedAt: 'desc' } }))
        .status,
    ).toBe('RECONCILIATION_REQUIRED');
    expect(await prisma.reconciliationIssue.count()).toBe(1);
  });

  it('schedules safe read retry without creating a false event', async () => {
    provider.failure = new PaymentProviderError('SAFE_TO_RETRY', 'PROVIDER_UNAVAILABLE');
    await ingress.acceptEfiBilling('retry_delivery_123');
    await worker.processOne();
    const inbox = await prisma.providerNotificationInbox.findFirstOrThrow();
    expect(inbox).toMatchObject({
      status: 'RETRY_SCHEDULED',
      attempts: 1,
      lastErrorCode: 'PROVIDER_UNAVAILABLE',
    });
    expect(inbox.availableAt.getTime()).toBeGreaterThan(Date.now());
    expect(await prisma.providerWebhookEvent.count()).toBe(0);
  });

  it('fences a stale worker failure after a newer claim has processed the inbox', async () => {
    const first = deferred<ProviderWebhook[]>();
    provider.handler = (call) => (call === 1 ? first.promise : Promise.resolve([event()]));
    await ingress.acceptEfiBilling('fenced_processed_123');
    const workerA = worker.processOne();
    await waitFor(() => provider.calls === 1);
    await makeClaimStale(prisma);
    await worker.processOne();
    expect((await prisma.providerNotificationInbox.findFirstOrThrow()).attempts).toBe(2);
    first.reject(new PaymentProviderError('DEFINITIVE', 'LATE_OLD_WORKER_FAILURE'));
    await workerA;
    expect(await prisma.providerNotificationInbox.findFirstOrThrow()).toMatchObject({
      status: 'PROCESSED',
      attempts: 2,
      lastErrorCode: null,
    });
    expect(await prisma.providerWebhookEvent.count()).toBe(1);
  });

  it('fences stale normal completion after a newer claim requires reconciliation', async () => {
    const first = deferred<ProviderWebhook[]>();
    provider.handler = (call) =>
      call === 1
        ? first.promise
        : Promise.reject(new PaymentProviderError('AMBIGUOUS', 'AMBIGUOUS_PROVIDER_READ'));
    await ingress.acceptEfiBilling('fenced_reconciliation_123');
    const workerA = worker.processOne();
    await waitFor(() => provider.calls === 1);
    await makeClaimStale(prisma);
    await worker.processOne();
    first.resolve([event()]);
    await workerA;
    expect(await prisma.providerNotificationInbox.findFirstOrThrow()).toMatchObject({
      status: 'RECONCILIATION_REQUIRED',
      attempts: 2,
      lastErrorCode: 'AMBIGUOUS_PROVIDER_READ',
    });
    expect(await prisma.reconciliationIssue.count()).toBe(1);
    expect(await prisma.providerWebhookEvent.count()).toBe(0);
  });

  it('materializes an ambiguous provider read only as reconciliation', async () => {
    provider.failure = new PaymentProviderError('AMBIGUOUS', 'AMBIGUOUS_PROVIDER_READ');
    await ingress.acceptEfiBilling('ambiguous_delivery_123');
    await worker.processOne();
    expect((await prisma.providerNotificationInbox.findFirstOrThrow()).status).toBe(
      'RECONCILIATION_REQUIRED',
    );
    expect(await prisma.reconciliationIssue.count()).toBe(1);
    expect(await prisma.providerWebhookEvent.count()).toBe(0);
  });

  it('makes a definitive provider error terminal without inventing an event', async () => {
    provider.failure = new PaymentProviderError('DEFINITIVE', 'INVALID_REQUEST');
    await ingress.acceptEfiBilling('definitive_delivery_123');
    await worker.processOne();
    expect(await prisma.providerNotificationInbox.findFirstOrThrow()).toMatchObject({
      status: 'FAILED',
      lastErrorCode: 'INVALID_REQUEST',
    });
    expect(await prisma.reconciliationIssue.count()).toBe(0);
    expect(await prisma.providerWebhookEvent.count()).toBe(0);
  });

  it('rolls back finalization failure and retries the normalized event exactly once', async () => {
    provider.events = [{ ...event(), paymentId: undefined } as unknown as ProviderWebhook];
    await ingress.acceptEfiBilling('finalization_retry_123');
    await worker.processOne();
    expect(await prisma.providerWebhookEvent.count()).toBe(0);
    expect(await prisma.providerNotificationInbox.findFirstOrThrow()).toMatchObject({
      status: 'RETRY_SCHEDULED',
      lastErrorCode: 'LOCAL_FINALIZATION_FAILED',
    });
    await prisma.providerNotificationInbox.updateMany({ data: { availableAt: new Date(0) } });
    provider.events = [event()];
    await worker.processOne();
    expect(await prisma.providerWebhookEvent.count()).toBe(1);
    expect(await prisma.providerNotificationInbox.findFirstOrThrow()).toMatchObject({
      status: 'PROCESSED',
      attempts: 2,
    });
  });

  it('persists only a RECEIVED provider event and has no financial side effects', async () => {
    const fixture = await commerceFixture(prisma);
    const cart = await prisma.cart.create({
      data: {
        buyerUserId: fixture.buyer.id,
        sellerProfileId: fixture.seller.id,
        status: 'CHECKED_OUT',
        checkedOutAt: new Date(),
      },
    });
    const order = await prisma.order.create({
      data: {
        publicCode: `NOTIFY-${crypto.randomUUID()}`,
        sourceCartId: cart.id,
        sourceCartVersion: 1,
        buyerUserId: fixture.buyer.id,
        sellerProfileId: fixture.seller.id,
        subtotalAmountMinor: 1_000n,
        totalAmountMinor: 1_000n,
        paymentStatus: 'PENDING',
        expiresAt: new Date(Date.now() + 60_000),
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
        expiresAt: order.expiresAt,
      },
    });
    const payment = await prisma.payment.create({
      data: { orderId: order.id, amountMinor: 1_000n },
    });
    const financialCounts = await Promise.all([
      prisma.ledgerTransaction.count(),
      prisma.ledgerEntry.count(),
      prisma.settlement.count(),
      prisma.financialHold.count(),
    ]);
    provider.events = [event()];
    await ingress.acceptEfiBilling('no_financial_effect_123');
    await worker.processOne();
    expect(await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).toMatchObject({
      status: 'PENDING',
    });
    expect(await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).toMatchObject({
      status: 'PENDING_PAYMENT',
      paymentStatus: 'PENDING',
    });
    expect(
      await prisma.inventoryReservation.findUniqueOrThrow({ where: { id: reservation.id } }),
    ).toMatchObject({ status: 'ACTIVE', releasedAt: null, consumedAt: null });
    expect(
      await Promise.all([
        prisma.ledgerTransaction.count(),
        prisma.ledgerEntry.count(),
        prisma.settlement.count(),
        prisma.financialHold.count(),
      ]),
    ).toEqual(financialCounts);
    expect(await prisma.providerWebhookEvent.findFirstOrThrow()).toMatchObject({
      status: 'RECEIVED',
    });
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "User", "CatalogCategory" CASCADE');
  });
});

async function makeClaimStale(prisma: PrismaService): Promise<void> {
  await prisma.providerNotificationInbox.updateMany({
    where: { status: 'PROCESSING' },
    data: { processingStartedAt: new Date(Date.now() - 6 * 60_000) },
  });
}

async function waitFor(predicate: () => boolean): Promise<void> {
  while (!predicate()) await new Promise((resolve) => setTimeout(resolve, 5));
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function event(): ProviderWebhook {
  return {
    externalEventId: 'a'.repeat(64),
    type: 'PAYMENT_STATUS_CHANGED',
    paymentId: '1234567',
    status: 'SUCCEEDED',
    payloadHash: 'a'.repeat(64),
    occurredAt: new Date('2026-08-03T12:00:00.000Z'),
  };
}
