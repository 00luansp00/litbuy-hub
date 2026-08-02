export class FinancialDomainError extends Error {
  constructor(
    public readonly code:
      | 'INVALID_MONEY'
      | 'INVALID_TRANSITION'
      | 'IDEMPOTENCY_KEY_REUSED'
      | 'INSUFFICIENT_FINANCIAL_BALANCE'
      | 'POLICY_NOT_FOUND',
    message: string = code,
  ) {
    super(message);
  }
}
