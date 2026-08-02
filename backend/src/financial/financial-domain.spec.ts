import { calculateFee, selectEffectivePolicy } from './fee-engine';
import { FakePaymentProvider } from './fake-payment-provider';
import { assertFinancialTransition, canFinancialTransition } from './state-machines';
import { MVP_WITHDRAWAL_POLICY } from './withdrawal-policy';
const rule = (overrides: Record<string, unknown> = {}) =>
  ({
    formula: 'PERCENT_BPS' as const,
    percentBps: 250,
    fixedAmountMinor: null,
    minimumAmountMinor: null,
    maximumAmountMinor: null,
    ...overrides,
  }) as never;
describe('financial domain', () => {
  test('uses bigint basis points, fixed, combined, min and max', () => {
    expect(calculateFee(10_001n, rule())).toBe(250n);
    expect(calculateFee(100n, rule({ formula: 'FIXED', fixedAmountMinor: 17n }))).toBe(17n);
    expect(
      calculateFee(10_000n, rule({ formula: 'PERCENT_BPS_PLUS_FIXED', fixedAmountMinor: 5n })),
    ).toBe(255n);
    expect(calculateFee(100n, rule({ minimumAmountMinor: 9n }))).toBe(9n);
    expect(calculateFee(10_000n, rule({ maximumAmountMinor: 100n }))).toBe(100n);
  });
  test.each([
    ['payment', 'PENDING', 'PAID'],
    ['paymentAttempt', 'PENDING', 'SUCCEEDED'],
    ['providerAccount', 'PENDING_KYC', 'ACTIVE'],
    ['hold', 'ACTIVE', 'BLOCKED'],
    ['settlement', 'HELD', 'AVAILABLE'],
    ['transfer', 'PROCESSING', 'SUCCEEDED'],
    ['withdrawal', 'PENDING_REVIEW', 'APPROVED'],
    ['refund', 'PROCESSING', 'SUCCEEDED'],
    ['chargeback', 'CONTESTED', 'WON'],
    ['webhook', 'FAILED', 'DEAD_LETTER'],
    ['reconciliation', 'OPEN', 'INVESTIGATING'],
    ['feePolicy', 'DRAFT', 'SCHEDULED'],
    ['withdrawalPolicy', 'ACTIVE', 'RETIRED'],
  ] as const)('%s allows explicit edges', (machine, from, to) =>
    expect(canFinancialTransition(machine, from, to)).toBe(true),
  );
  test('rejects implicit edges', () => {
    try {
      assertFinancialTransition('withdrawal', 'PENDING_REVIEW', 'SUCCEEDED');
      fail('expected');
    } catch (error) {
      expect(error).toMatchObject({ code: 'INVALID_TRANSITION' });
    }
  });
  test('selects exactly one historical policy', () => {
    const old = {
      effectiveFrom: new Date('2026-01-01'),
      effectiveTo: new Date('2026-02-01'),
      version: 1,
    };
    const current = { effectiveFrom: new Date('2026-02-01'), effectiveTo: null, version: 2 };
    expect(selectEffectivePolicy([old, current], new Date('2026-01-15'))).toBe(old);
    expect(selectEffectivePolicy([old, current], new Date('2026-03-01'))).toBe(current);
  });
  test('freezes withdrawal MVP baseline', () => {
    expect(MVP_WITHDRAWAL_POLICY.STANDARD).toMatchObject({
      enabled: true,
      slaHours: 48,
      approvalMode: 'MANUAL',
      feeFixedAmountMinor: 0n,
    });
    expect(MVP_WITHDRAWAL_POLICY.INSTANT.enabled).toBe(false);
  });
  test('fake provider is deterministic and network-free', async () => {
    const provider = new FakePaymentProvider();
    const input = {
      reference: 'order',
      money: { amountMinor: 10000n, currency: 'BRL' as const },
      idempotencyHash: 'hash',
    };
    const first = await provider.createPayment(input);
    expect(await provider.createPayment(input)).toBe(first);
    expect(provider.simulate(first.id, 'SUCCEEDED').status).toBe('SUCCEEDED');
    expect(await provider.verifyWebhook(new Uint8Array(), 'bad')).toBe(false);
    expect(await provider.verifyWebhook(new Uint8Array(), 'fake-valid-signature')).toBe(true);
  });
});
