export class FinancialDomainError extends Error {
  constructor(
    public readonly code:
      | 'INVALID_MONEY'
      | 'INVALID_TRANSITION'
      | 'IDEMPOTENCY_KEY_REUSED'
      | 'INSUFFICIENT_FINANCIAL_BALANCE'
      | 'POLICY_NOT_FOUND'
      | 'INVALID_FEE_RULE'
      | 'FEE_RULE_AMBIGUOUS'
      | 'FINANCIAL_CONCURRENCY_CONFLICT',
    message: string = code,
  ) {
    super(message);
  }
}
