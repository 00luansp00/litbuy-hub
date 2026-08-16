import { FakePaymentProvider } from './fake-payment-provider';

describe('FakePaymentProvider', () => {
  const paymentInput = (idempotencyHash: string) => ({
    reference: 'order-reference',
    money: { amountMinor: 1000n, currency: 'BRL' as const },
    idempotencyHash,
  });

  it('returns the same payment for the same idempotency hash in one instance', async () => {
    const provider = new FakePaymentProvider('FAKE_ALPHA');

    const first = await provider.createPayment(paymentInput('same-operation'));
    const replay = await provider.createPayment(paymentInput('same-operation'));

    expect(replay).toBe(first);
    expect(replay.id).toBe(first.id);
  });

  it('derives the same external id after a simulated backend restart', async () => {
    const beforeRestart = new FakePaymentProvider('FAKE_ALPHA');
    const afterRestart = new FakePaymentProvider('FAKE_ALPHA');

    const first = await beforeRestart.createPayment(paymentInput('restart-safe-operation'));
    const replay = await afterRestart.createPayment(paymentInput('restart-safe-operation'));

    expect(replay.id).toBe(first.id);
    expect(replay.id).toMatch(/^fake_payment_[a-f0-9]{64}$/);
  });

  it('does not reuse an external id for a different operation after restart', async () => {
    const beforeRestart = new FakePaymentProvider('FAKE_ALPHA');
    const afterRestart = new FakePaymentProvider('FAKE_ALPHA');

    const first = await beforeRestart.createPayment(paymentInput('operation-before-restart'));
    const second = await afterRestart.createPayment(paymentInput('operation-after-restart'));

    expect(second.id).not.toBe(first.id);
  });

  it('continues to simulate provider payment status changes', async () => {
    const provider = new FakePaymentProvider('FAKE_ALPHA');
    const payment = await provider.createPayment(paymentInput('simulated-operation'));

    expect(provider.simulate(payment.id, 'SUCCEEDED')).toEqual({
      ...payment,
      status: 'SUCCEEDED',
    });
    await expect(provider.getPayment(payment.id)).resolves.toMatchObject({
      status: 'SUCCEEDED',
    });
  });
});
