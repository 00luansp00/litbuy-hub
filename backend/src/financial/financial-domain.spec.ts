import {
  calculateFee,
  calculateResolvedFee,
  resolveFeeRule,
  selectEffectivePolicy,
  validateFeeRule,
} from './fee-engine';
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
    expect(
      calculateFee(100n, rule({ formula: 'FIXED', percentBps: null, fixedAmountMinor: 17n })),
    ).toBe(17n);
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

describe('deterministic fee resolver', () => {
  const synthetic = (overrides: Record<string, unknown> = {}) =>
    ({
      id: crypto.randomUUID(),
      code: crypto.randomUUID(),
      category: 'PAYMENT_METHOD_SURCHARGE',
      partyCharged: 'BUYER',
      formula: 'FIXED',
      percentBps: null,
      fixedAmountMinor: 10n,
      minimumAmountMinor: null,
      maximumAmountMinor: null,
      paymentMethod: null,
      installmentsFrom: null,
      installmentsTo: null,
      sellerLevel: null,
      sellerPlan: null,
      promotionTier: null,
      withdrawalSpeed: null,
      productType: null,
      priority: 0,
      enabled: true,
      ...overrides,
    }) as never;
  const context = (overrides: Record<string, unknown> = {}) =>
    ({ partyCharged: 'BUYER', ...overrides }) as never;
  test.each([
    ['PIX', { paymentMethod: 'PIX' }, { paymentMethod: 'PIX' }],
    ['BOLETO', { paymentMethod: 'BOLETO' }, { paymentMethod: 'BOLETO' }],
    [
      'CARD installments',
      { paymentMethod: 'CARD', installmentsFrom: 2, installmentsTo: 6 },
      { paymentMethod: 'CARD', installments: 4 },
    ],
    ['seller level', { sellerLevel: 'SYNTHETIC_GOLD' }, { sellerLevel: 'SYNTHETIC_GOLD' }],
    ['LIT-MAX', { sellerPlan: 'LIT_MAX' }, { sellerPlan: 'LIT_MAX' }],
    ['promotion SILVER', { promotionTier: 'SILVER' }, { promotionTier: 'SILVER' }],
    ['promotion GOLD', { promotionTier: 'GOLD' }, { promotionTier: 'GOLD' }],
    ['promotion DIAMOND', { promotionTier: 'DIAMOND' }, { promotionTier: 'DIAMOND' }],
    [
      'STANDARD withdrawal',
      { category: 'WITHDRAWAL_FEE', withdrawalSpeed: 'STANDARD', partyCharged: 'SELLER' },
      { withdrawalSpeed: 'STANDARD', partyCharged: 'SELLER' },
    ],
    [
      'INSTANT withdrawal',
      { category: 'WITHDRAWAL_FEE', withdrawalSpeed: 'INSTANT', partyCharged: 'SELLER' },
      { withdrawalSpeed: 'INSTANT', partyCharged: 'SELLER' },
    ],
    ['product type', { productType: 'SOFTWARE' }, { productType: 'SOFTWARE' }],
    ['buyer benefit', { category: 'BUYER_BENEFIT' }, {}],
  ] as const)('resolves %s', (_name, qualifier, actual) => {
    const feeCategory = ((qualifier as Record<string, unknown>).category ??
      'PAYMENT_METHOD_SURCHARGE') as never;
    expect(
      calculateResolvedFee(10_000n, [synthetic(qualifier)], feeCategory, context(actual)),
    ).toBe(10n);
  });
  it('prefers priority, then the more specific applicable rule, regardless of order', () => {
    const general = synthetic({ fixedAmountMinor: 1n });
    const pix = synthetic({ paymentMethod: 'PIX', fixedAmountMinor: 2n });
    const priority = synthetic({ paymentMethod: 'PIX', priority: 5, fixedAmountMinor: 3n });
    expect(
      resolveFeeRule(
        [priority, general, pix],
        'PAYMENT_METHOD_SURCHARGE',
        context({ paymentMethod: 'PIX' }),
      ),
    ).toBe(priority);
    expect(
      resolveFeeRule([general, pix], 'PAYMENT_METHOD_SURCHARGE', context({ paymentMethod: 'PIX' })),
    ).toBe(pix);
  });
  it('respects charged party and rejects equally ranked ambiguity', () => {
    expect(
      resolveFeeRule(
        [synthetic()],
        'PAYMENT_METHOD_SURCHARGE',
        context({ partyCharged: 'SELLER' }),
      ),
    ).toBeNull();
    expect(() =>
      resolveFeeRule([synthetic(), synthetic()], 'PAYMENT_METHOD_SURCHARGE', context()),
    ).toThrow();
  });
  it('rejects malformed formula and installment configurations', () => {
    expect(() =>
      calculateFee(100n, synthetic({ formula: 'FIXED', fixedAmountMinor: null })),
    ).toThrow();
    expect(() => validateFeeRule(synthetic({ installmentsFrom: 5, installmentsTo: 2 }))).toThrow();
  });
});

describe('authoritative payment state graph', () => {
  const allowed: Record<string, string[]> = {
    PENDING: ['PROCESSING', 'PAID', 'FAILED', 'EXPIRED'],
    PROCESSING: ['PAID', 'FAILED', 'EXPIRED'],
    PAID: ['REFUND_PENDING', 'CHARGEBACK'],
    REFUND_PENDING: ['PARTIALLY_REFUNDED', 'REFUNDED', 'PAID', 'CHARGEBACK'],
    PARTIALLY_REFUNDED: ['REFUND_PENDING', 'CHARGEBACK'],
    REFUNDED: ['CHARGEBACK'],
    FAILED: [],
    EXPIRED: [],
    CHARGEBACK: [],
    NOT_CREATED: ['PENDING'],
  };
  for (const [from, targets] of Object.entries(allowed))
    for (const to of Object.keys(allowed))
      test(`${from} -> ${to}`, () =>
        expect(canFinancialTransition('payment', from, to)).toBe(targets.includes(to)));
});

describe('authoritative payment attempt state graph', () => {
  const allowed: Record<string, string[]> = {
    CREATED: ['PENDING', 'PROCESSING', 'CANCELLED'],
    PENDING: ['PROCESSING', 'REQUIRES_ACTION', 'SUCCEEDED', 'FAILED', 'EXPIRED', 'CANCELLED'],
    PROCESSING: ['REQUIRES_ACTION', 'SUCCEEDED', 'FAILED', 'EXPIRED'],
    REQUIRES_ACTION: ['PROCESSING', 'SUCCEEDED', 'FAILED', 'EXPIRED', 'CANCELLED'],
    SUCCEEDED: [],
    FAILED: [],
    EXPIRED: [],
    CANCELLED: [],
  };
  for (const [from, targets] of Object.entries(allowed))
    for (const to of Object.keys(allowed))
      test(`${from} -> ${to}`, () =>
        expect(canFinancialTransition('paymentAttempt', from, to)).toBe(targets.includes(to)));
});
