import { BuyerPaymentService } from './buyer-payment.service';
import { FakePaymentProvider } from './fake-payment-provider';

const order = {
  id: '00000000-0000-0000-0000-000000000001',
  publicCode: 'LIT-ORDER',
  buyerUserId: 'buyer',
  status: 'PENDING_PAYMENT',
  paymentStatus: 'PENDING',
  totalAmountMinor: 1000n,
  currency: 'BRL',
};
const attempt = {
  id: '00000000-0000-0000-0000-000000000002',
  paymentId: 'payment',
  providerCode: 'FAKE_ALPHA',
  status: 'PENDING',
  externalPaymentId: 'fake_payment_1',
  payment: { id: 'payment', orderId: order.id, status: 'PENDING' },
};
const event = {
  id: '00000000-0000-0000-0000-000000000003',
  providerCode: 'FAKE_ALPHA',
  externalEventId: 'event',
  externalPaymentId: attempt.externalPaymentId,
  eventType: 'ALPHA_PAYMENT_SUCCEEDED',
  status: 'RECEIVED',
};

describe('BuyerPaymentService Alpha confirmation', () => {
  function subject(options: { keyed?: typeof event; confirmed?: boolean } = {}) {
    const provider = new FakePaymentProvider('FAKE_ALPHA');
    const created = (provider as unknown as { payments: Map<string, unknown> }).payments;
    created.set(attempt.externalPaymentId, {
      id: attempt.externalPaymentId,
      status: 'PENDING',
      money: { amountMinor: 1000n, currency: 'BRL' },
    });
    const simulate = jest.spyOn(provider, 'simulate');
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: order.id }]),
      order: { findFirst: jest.fn().mockResolvedValue(order) },
      paymentAttempt: { findFirst: jest.fn().mockResolvedValue(attempt) },
      providerWebhookEvent: {
        findUnique: jest.fn().mockResolvedValue(options.keyed ?? null),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(event),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
      paymentAttempt: {
        findUnique: jest.fn().mockResolvedValue(
          options.confirmed === false
            ? attempt
            : {
                ...attempt,
                status: 'SUCCEEDED',
                payment: { ...attempt.payment, status: 'PAID' },
              },
        ),
      },
      payment: {
        findUnique: jest.fn().mockResolvedValue({
          ...attempt.payment,
          amountMinor: 1000n,
          attempts: [
            {
              ...attempt,
              status: 'SUCCEEDED',
              attemptNumber: 1,
              amountMinor: 1000n,
              currency: 'BRL',
            },
          ],
        }),
      },
      order: { findFirst: jest.fn().mockResolvedValue(order) },
    };
    const events = { processOne: jest.fn().mockResolvedValue(true) };
    const alphaPostPayment = { progress: jest.fn().mockResolvedValue(undefined) };
    const service = new BuyerPaymentService(
      prisma as never,
      { initiateBilling: jest.fn() } as never,
      events as never,
      alphaPostPayment as never,
      provider,
      { enabled: true },
    );
    return { service, provider, simulate, tx, prisma, events, alphaPostPayment };
  }
  const key = (hash: string) => ({ hash }) as never;

  it('persists then processes exactly the created event and ensures availability only after PAID', async () => {
    const s = subject();
    await s.service.confirm('buyer', order.publicCode, attempt.id, key('same'));
    expect(s.tx.providerWebhookEvent.create.mock.invocationCallOrder[0]).toBeLessThan(
      s.simulate.mock.invocationCallOrder[0],
    );
    expect(s.events.processOne).toHaveBeenCalledWith(event.id);
    expect(s.alphaPostPayment.progress).toHaveBeenCalledWith(order.id);
    expect(s.prisma.paymentAttempt.findUnique.mock.invocationCallOrder[0]).toBeLessThan(
      s.alphaPostPayment.progress.mock.invocationCallOrder[0],
    );
  });

  it('does not progress the order when the specific processor leaves payment unconfirmed', async () => {
    const s = subject({ confirmed: false });
    await expect(
      s.service.confirm('buyer', order.publicCode, attempt.id, key('same')),
    ).rejects.toMatchObject({ code: 'PAYMENT_RECONCILIATION_REQUIRED' });
    expect(s.alphaPostPayment.progress).not.toHaveBeenCalled();
  });

  it('rejects incompatible key reuse before mutating fake provider', async () => {
    const s = subject({ keyed: { ...event, externalPaymentId: 'other-payment' } });
    await expect(
      s.service.confirm('buyer', order.publicCode, attempt.id, key('reused')),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED' });
    expect(s.simulate).not.toHaveBeenCalled();
    expect(s.events.processOne).not.toHaveBeenCalled();
  });

  it('replays the same durable event without another provider mutation', async () => {
    const s = subject({
      keyed: { ...event, externalPaymentId: attempt.externalPaymentId, status: 'PROCESSED' },
    });
    await s.service.confirm('buyer', order.publicCode, attempt.id, key('same'));
    expect(s.simulate).not.toHaveBeenCalled();
    expect(s.events.processOne).not.toHaveBeenCalled();
    expect(s.alphaPostPayment.progress).toHaveBeenCalledTimes(1);
  });

  it('does not enter the Alpha composition in production', async () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const s = subject();
    try {
      await expect(
        s.service.confirm('buyer', order.publicCode, attempt.id, key('same')),
      ).rejects.toMatchObject({ code: 'ALPHA_SIMULATION_UNAVAILABLE' });
      expect(s.alphaPostPayment.progress).not.toHaveBeenCalled();
    } finally {
      process.env.NODE_ENV = previous;
    }
  });
});
