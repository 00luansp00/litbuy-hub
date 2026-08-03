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
      | 'FINANCIAL_CONCURRENCY_CONFLICT'
      | 'ORDER_NOT_PAYMENT_ELIGIBLE'
      | 'PAYMENT_ATTEMPT_IN_PROGRESS'
      | 'PAYMENT_PROVIDER_FAILURE'
      | 'PAYMENT_RECONCILIATION_REQUIRED',
    message: string = code,
  ) {
    super(message);
  }
}
