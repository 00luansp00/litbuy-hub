import {
  cumulativeFeeAllocation,
  DisputeSellerLiabilityService,
} from './dispute-seller-liability.service';

describe('DisputeSellerLiabilityService', () => {
  it('allocates a total decision exactly', () =>
    expect(cumulativeFeeAllocation(137n, 0n, 1000n, 1000n)).toBe(137n));
  it('uses integer cumulative rounding and reconciles the final increment', () => {
    const first = cumulativeFeeAllocation(101n, 0n, 333n, 1000n);
    const second = cumulativeFeeAllocation(101n, 333n, 667n, 1000n);
    expect(first).toBe(33n);
    expect(second).toBe(68n);
    expect(first + second).toBe(101n);
  });
  it('retries only serialization failures', async () => {
    const prisma = {
      $transaction: jest.fn().mockRejectedValue(Object.assign(new Error(), { code: 'P2034' })),
    };
    await expect(
      new DisputeSellerLiabilityService(prisma as never).createForFinancialDecision(
        crypto.randomUUID(),
      ),
    ).rejects.toBeDefined();
    expect(prisma.$transaction).toHaveBeenCalledTimes(3);
  });
  it('fails closed when the decision does not exist', async () => {
    const tx = { disputeFinancialDecision: { findUnique: jest.fn().mockResolvedValue(null) } };
    const prisma = { $transaction: jest.fn((work: (arg: typeof tx) => unknown) => work(tx)) };
    await expect(
      new DisputeSellerLiabilityService(prisma as never).createForFinancialDecision(
        crypto.randomUUID(),
      ),
    ).rejects.toMatchObject({ code: 'SELLER_LIABILITY_DECISION_NOT_FOUND' });
  });
});
