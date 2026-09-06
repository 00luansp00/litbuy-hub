import { DisputeRecoveryService } from './dispute-recovery.service';

describe('DisputeRecoveryService', () => {
  it('returns ZERO_SELLER_LIABILITY without provisioning, claim or posting', async () => {
    const prisma = {
      disputeSellerLiability: {
        findUnique: jest.fn().mockResolvedValue({
          sellerProfileId: '00000000-0000-0000-0000-000000000001',
          sellerLiabilityAmountMinor: 0n,
        }),
      },
      $transaction: jest.fn(),
    };
    const ledger = {
      ensureSellerLedgerAccounts: jest.fn(),
      postWithOutcomeInTransaction: jest.fn(),
    };
    const service = new DisputeRecoveryService(prisma as never, ledger as never);

    await expect(
      service.processForLiability('00000000-0000-0000-0000-000000000002'),
    ).resolves.toEqual({
      outcome: 'ZERO_SELLER_LIABILITY',
      disputeSellerLiabilityId: '00000000-0000-0000-0000-000000000002',
    });
    expect(ledger.ensureSellerLedgerAccounts).not.toHaveBeenCalled();
    expect(ledger.postWithOutcomeInTransaction).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
