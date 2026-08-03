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

class ControlledNotificationProvider implements PaymentProviderNotificationPort {
  readonly providerCode = 'EFI_BILLING';
  calls = 0;
  failure?: PaymentProviderError;
  events: ProviderWebhook[] = [];
  release: Promise<void> = Promise.resolve();
  assertAvailable() {}
  async resolveNotification() {
    this.calls += 1;
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
});

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
