import { PaymentProviderError } from './payment-provider.port';

describe('provider-neutral payment orchestration boundary', () => {
  it.each([
    ['DEFINITIVE', false],
    ['SAFE_TO_RETRY', false],
    ['AMBIGUOUS', true],
  ] as const)('classifies %s without importing an adapter error', (kind, reconciliation) => {
    const error = new PaymentProviderError(kind, 'NORMALIZED_REASON');
    expect(error).toMatchObject({ kind, reason: 'NORMALIZED_REASON' });
    expect(error.requiresReconciliation).toBe(reconciliation);
    expect(error.message).not.toContain('credential');
  });
});
