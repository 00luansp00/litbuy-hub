import { Test } from '@nestjs/testing';
import { PaymentAttemptStatus } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { parseIdempotencyKey } from '../src/commerce/idempotency-key';
import { PrismaService } from '../src/database/prisma.service';
import {
  PAYMENT_PROVIDER_PORT,
  PaymentOrchestrationService,
} from '../src/financial/payment-orchestration.service';
import {
  PaymentProviderError,
  type PaymentProviderPort,
} from '../src/financial/payment-provider.port';
import { commerceFixture } from './order-checkout-test.helpers';

class ControlledProvider implements PaymentProviderPort {
  readonly providerCode = 'EFI_BILLING';
  calls = 0;
  failure?: Error;
  status: 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'EXPIRED' = 'PENDING';
  amountDelta = 0n;
  availabilityError?: PaymentProviderError;
  release: Promise<void> = Promise.resolve();
  assertAvailable() {
    if (this.availabilityError) throw this.availabilityError;
  }
  async createPayment(input: Parameters<PaymentProviderPort['createPayment']>[0]) {
    this.calls += 1;
    await this.release;
    if (this.failure) throw this.failure;
    return {
      id: `efi-${this.calls}`,
      status: this.status,
      money: {
        amountMinor: input.money.amountMinor + this.amountDelta,
        currency: input.money.currency,
      },
    };
  }
  getPayment() {
    return Promise.resolve(null);
  }
  cancelPayment() {
    return Promise.reject(new Error('not used'));
  }
  refundPayment() {
    return Promise.reject(new Error('not used'));
  }
}

describe('Payment orchestration with real PostgreSQL', () => {
  jest.setTimeout(120_000);
  const provider = new ControlledProvider();
  let module: Awaited<ReturnType<ReturnType<typeof Test.createTestingModule>['compile']>>;
  let prisma: PrismaService;
  let service: PaymentOrchestrationService;
  let fixture: Awaited<ReturnType<typeof commerceFixture>>;

  beforeAll(async () => {
    module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PAYMENT_PROVIDER_PORT)
      .useValue(provider)
      .compile();
    prisma = module.get(PrismaService);
    service = module.get(PaymentOrchestrationService);
  });
  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "User", "CatalogCategory", "ReconciliationIssue" CASCADE',
    );
    fixture = await commerceFixture(prisma);
    provider.calls = 0;
    provider.failure = undefined;
    provider.status = 'PENDING';
    provider.amountDelta = 0n;
    provider.availabilityError = undefined;
    provider.release = Promise.resolve();
  });
  afterAll(() => module.close());

  async function order(overrides: Record<string, unknown> = {}) {
    const cart = await prisma.cart.create({
      data: {
        buyerUserId: fixture.buyer.id,
        sellerProfileId: fixture.seller.id,
        status: 'CHECKED_OUT',
        checkedOutAt: new Date(),
      },
    });
    return prisma.order.create({
      data: {
        publicCode: `PAY-${crypto.randomUUID()}`,
        sourceCartId: cart.id,
        sourceCartVersion: 1,
        buyerUserId: fixture.buyer.id,
        sellerProfileId: fixture.seller.id,
        subtotalAmountMinor: 12_345n,
        totalAmountMinor: 12_345n,
        expiresAt: new Date(Date.now() + 60_000),
        ...overrides,
      },
    });
  }
  const key = (value: string = crypto.randomUUID()) => parseIdempotencyKey(`payment-${value}`);

  it('fails before local persistence when the provider is deliberately unavailable', async () => {
    const created = await order();
    provider.availabilityError = new PaymentProviderError('DEFINITIVE', 'PROVIDER_DISABLED');
    await expect(
      service.initiateBilling(fixture.buyer.id, created.id, key()),
    ).rejects.toMatchObject({
      reason: 'PROVIDER_DISABLED',
    });
    expect(provider.calls).toBe(0);
    expect(await prisma.payment.count()).toBe(0);
    expect(await prisma.paymentAttempt.count()).toBe(0);
  });

  it('creates one authoritative PENDING Payment and Billing attempt without activating or posting', async () => {
    const created = await order();
    const beforeLedger = await prisma.ledgerTransaction.count();
    const result = await service.initiateBilling(fixture.buyer.id, created.id, key());
    const [storedOrder, payment, attempt] = await Promise.all([
      prisma.order.findUniqueOrThrow({ where: { id: created.id } }),
      prisma.payment.findUniqueOrThrow({ where: { orderId: created.id } }),
      prisma.paymentAttempt.findUniqueOrThrow({ where: { id: result.attemptId } }),
    ]);
    expect(payment).toMatchObject({ amountMinor: 12_345n, currency: 'BRL', status: 'PENDING' });
    expect(attempt).toMatchObject({
      attemptNumber: 1,
      providerCode: provider.providerCode,
      method: null,
      status: 'PENDING',
      amountMinor: 12_345n,
      currency: 'BRL',
      externalPaymentId: 'efi-1',
    });
    expect(payment.status).not.toBe('NOT_CREATED');
    expect(storedOrder).toMatchObject({ status: 'PENDING_PAYMENT', paymentStatus: 'PENDING' });
    expect(await prisma.payment.count({ where: { orderId: created.id } })).toBe(1);
    expect(await prisma.ledgerTransaction.count()).toBe(beforeLedger);
  });

  it('deduplicates the same key/request and rejects changed request without another provider call', async () => {
    const firstOrder = await order();
    const idempotency = key();
    const first = await service.initiateBilling(fixture.buyer.id, firstOrder.id, idempotency);
    const replay = await service.initiateBilling(fixture.buyer.id, firstOrder.id, idempotency);
    expect(replay).toEqual(first);
    const secondOrder = await order();
    await expect(
      service.initiateBilling(fixture.buyer.id, secondOrder.id, idempotency),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED' });
    expect(provider.calls).toBe(1);
    expect(await prisma.payment.count()).toBe(1);
  });

  it('serializes concurrent initialization so only one external mutation wins', async () => {
    const created = await order();
    let release!: () => void;
    provider.release = new Promise<void>((resolve) => {
      release = resolve;
    });
    const first = service.initiateBilling(fixture.buyer.id, created.id, key('concurrent-same-key'));
    await new Promise((resolve) => setTimeout(resolve, 30));
    const second = service.initiateBilling(
      fixture.buyer.id,
      created.id,
      key('concurrent-same-key'),
    );
    const replay = await second;
    expect(replay.externalPaymentId).toBeNull();
    expect(provider.calls).toBe(1);
    expect(await prisma.reconciliationIssue.count()).toBe(0);
    release();
    const completed = await first;
    expect(completed.externalPaymentId).toBe('efi-1');
    expect(provider.calls).toBe(1);
    expect(await prisma.payment.count({ where: { orderId: created.id } })).toBe(1);
    expect(await prisma.paymentAttempt.count()).toBe(1);
    expect(await prisma.reconciliationIssue.count()).toBe(0);
  });

  it.each([PaymentAttemptStatus.PENDING, PaymentAttemptStatus.PROCESSING])(
    'blocks a new key while an earlier attempt is %s',
    async (status) => {
      const created = await order();
      await service.initiateBilling(fixture.buyer.id, created.id, key('blocking-original'));
      await prisma.paymentAttempt.updateMany({ data: { status } });
      await expect(
        service.initiateBilling(fixture.buyer.id, created.id, key(`new-${status}`)),
      ).rejects.toMatchObject({ code: 'PAYMENT_ATTEMPT_IN_PROGRESS' });
      expect(provider.calls).toBe(1);
    },
  );

  it('creates sequential retry attempts only after a definitive failure', async () => {
    const created = await order();
    provider.failure = new PaymentProviderError('DEFINITIVE', 'DECLINED');
    await expect(
      service.initiateBilling(fixture.buyer.id, created.id, key('definitive-one')),
    ).rejects.toMatchObject({ code: 'PAYMENT_PROVIDER_FAILURE' });
    provider.failure = undefined;
    const retried = await service.initiateBilling(
      fixture.buyer.id,
      created.id,
      key('definitive-two'),
    );
    expect(retried.attemptNumber).toBe(2);
    expect(await prisma.payment.count({ where: { orderId: created.id } })).toBe(1);
    expect(await prisma.paymentAttempt.findMany({ orderBy: { attemptNumber: 'asc' } })).toEqual([
      expect.objectContaining({ attemptNumber: 1, status: 'FAILED' }),
      expect.objectContaining({ attemptNumber: 2, status: 'PENDING', externalPaymentId: 'efi-2' }),
    ]);
  });

  it('materializes ambiguous mutation reconciliation and blocks same or new keys', async () => {
    const created = await order();
    const original = key('ambiguous-original');
    provider.failure = new PaymentProviderError('AMBIGUOUS', 'SOCKET_RESET');
    await expect(
      service.initiateBilling(fixture.buyer.id, created.id, original),
    ).rejects.toMatchObject({
      code: 'PAYMENT_RECONCILIATION_REQUIRED',
    });
    expect(await prisma.reconciliationIssue.findFirst()).toMatchObject({
      providerCode: provider.providerCode,
      referenceType: 'PAYMENT_ATTEMPT',
      status: 'OPEN',
    });
    provider.failure = undefined;
    await expect(
      service.initiateBilling(fixture.buyer.id, created.id, original),
    ).rejects.toMatchObject({ code: 'PAYMENT_RECONCILIATION_REQUIRED' });
    await expect(
      service.initiateBilling(fixture.buyer.id, created.id, key('ambiguous-bypass')),
    ).rejects.toMatchObject({ code: 'PAYMENT_ATTEMPT_IN_PROGRESS' });
    expect(provider.calls).toBe(1);
    expect(await prisma.reconciliationIssue.count()).toBe(1);
  });

  it('fails closed and reconciles an unexpected final or amount response', async () => {
    const created = await order();
    const beforeLedger = await prisma.ledgerTransaction.count();
    provider.status = 'SUCCEEDED';
    await expect(
      service.initiateBilling(fixture.buyer.id, created.id, key()),
    ).rejects.toMatchObject({
      code: 'PAYMENT_RECONCILIATION_REQUIRED',
    });
    expect(await prisma.order.findUniqueOrThrow({ where: { id: created.id } })).toMatchObject({
      status: 'PENDING_PAYMENT',
      paymentStatus: 'PENDING',
    });
    expect(await prisma.ledgerTransaction.count()).toBe(beforeLedger);
    expect(await prisma.reconciliationIssue.count()).toBe(1);
  });

  it('provider success followed by local persistence failure never causes a second POST', async () => {
    const created = await order();
    const originalTransaction = prisma.$transaction.bind(prisma);
    const spy = jest.spyOn(prisma, '$transaction');
    spy.mockImplementationOnce(originalTransaction);
    spy.mockRejectedValueOnce(new Error('DATABASE_WRITE_FAILED'));
    spy.mockImplementation(originalTransaction);
    const original = key('post-provider-window');
    await expect(
      service.initiateBilling(fixture.buyer.id, created.id, original),
    ).rejects.toMatchObject({
      code: 'PAYMENT_RECONCILIATION_REQUIRED',
    });
    spy.mockRestore();
    await expect(
      service.initiateBilling(fixture.buyer.id, created.id, original),
    ).rejects.toMatchObject({ code: 'PAYMENT_RECONCILIATION_REQUIRED' });
    await expect(
      service.initiateBilling(fixture.buyer.id, created.id, key('post-provider-new-key')),
    ).rejects.toMatchObject({ code: 'PAYMENT_ATTEMPT_IN_PROGRESS' });
    expect(provider.calls).toBe(1);
    expect(await prisma.reconciliationIssue.count()).toBe(1);
  });

  it.each([
    ['expired', { expiresAt: new Date(Date.now() - 1) }],
    ['cancelled', { status: 'CANCELLED', cancelledAt: new Date() }],
  ])('rejects an %s order and rolls back all local intent', async (_name, overrides) => {
    const created = await order(overrides);
    await expect(
      service.initiateBilling(fixture.buyer.id, created.id, key()),
    ).rejects.toMatchObject({
      code: 'ORDER_NOT_PAYMENT_ELIGIBLE',
    });
    expect(provider.calls).toBe(0);
    expect(await prisma.payment.count()).toBe(0);
    expect(await prisma.paymentAttempt.count()).toBe(0);
  });

  it('does not reveal another buyer order and stores only hashes, never the raw key', async () => {
    const created = await order();
    const outsider = await prisma.user.create({
      data: {
        email: `outsider-${crypto.randomUUID()}@test.local`,
        birthDate: new Date('2000-01-01'),
        status: 'ACTIVE',
        termsVersion: 't',
        termsAcceptedAt: new Date(),
        privacyVersion: 'p',
        privacyAcceptedAt: new Date(),
      },
    });
    await expect(service.initiateBilling(outsider.id, created.id, key())).rejects.toMatchObject({
      code: 'ORDER_NOT_PAYMENT_ELIGIBLE',
    });
    const raw = 'payment-super-secret-idempotency-key';
    await service.initiateBilling(fixture.buyer.id, created.id, parseIdempotencyKey(raw));
    const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT * FROM "PaymentAttempt" WHERE "paymentId" = (SELECT id FROM "Payment" WHERE "orderId" = ${created.id}::uuid)
    `;
    expect(rows.some((row) => Object.values(row).some((value) => value === raw))).toBe(false);
  });
});
