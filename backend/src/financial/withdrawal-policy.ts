export const MVP_WITHDRAWAL_POLICY = {
  STANDARD: {
    enabled: true,
    slaHours: 48,
    approvalMode: 'MANUAL' as const,
    feeFixedAmountMinor: 0n,
  },
  INSTANT: {
    enabled: false,
    slaHours: 1,
    approvalMode: 'AUTOMATIC' as const,
    feeFixedAmountMinor: 0n,
  },
} as const;
