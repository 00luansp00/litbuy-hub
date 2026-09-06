import {
  deriveInitialDeficitAmountMinor,
  DisputeRecoveryService,
} from './dispute-recovery.service';

describe('DisputeRecoveryService', () => {
  it.each([
    { claim: 10_000n, reservations: [10_000n], expected: 0n, boundary: 'fully funded' },
    { claim: 10_000n, reservations: [4_000n], expected: 6_000n, boundary: 'partial' },
    { claim: 10_000n, reservations: [], expected: 10_000n, boundary: 'zero available' },
  ])('derives the AA1 amount at the $boundary boundary', ({ claim, reservations, expected }) => {
    expect(deriveInitialDeficitAmountMinor(claim, reservations)).toBe(expected);
  });

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
