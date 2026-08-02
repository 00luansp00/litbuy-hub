export const MARKETPLACE_WITHDRAWAL_RISK_FOUNDATION = Object.freeze({
  kycRequiredBeforeWithdrawal: true,
  sameOwnerDestinationRequired: true,
  thirdPartyDestinationForbidden: true,
  destinationChangeRequiresStepUpAndCooldown: true,
  deficitBlocksWithdrawal: true,
  restrictedSellerBlocksWithdrawal: true,
  reviewSignals: [
    'DISPUTE_OR_CHARGEBACK',
    'ABNORMAL_VOLUME',
    'RELATED_ACCOUNTS_OR_DEVICES',
    'RAPID_FUNDS_IN_OUT',
    'SELF_DEALING',
    'ABNORMAL_REFUND_OR_CHARGEBACK_RATE',
  ] as const,
});
