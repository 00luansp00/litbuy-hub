import { NotFoundException } from '@nestjs/common';
import { SellerFinanceReadService } from './seller-finance-read.service';

describe('SellerFinanceReadService', () => {
  const prisma = {
    sellerProfile: { findFirst: jest.fn() },
    ledgerTransaction: { findMany: jest.fn() },
  };
  const ledger = { getSellerFinancialBalance: jest.fn() };
  const service = new SellerFinanceReadService(prisma as never, ledger as never);
  beforeEach(() => jest.clearAllMocks());

  it('resolves the active seller from authenticated user and serializes bigint balances', async () => {
    prisma.sellerProfile.findFirst.mockResolvedValue({ id: 'seller-a' });
    ledger.getSellerFinancialBalance.mockResolvedValue({
      pending: 9000n,
      held: 0n,
      available: 0n,
      reserved: 0n,
      deficit: 0n,
      currency: 'BRL',
    });
    await expect(service.summary('user-a')).resolves.toEqual({
      currency: 'BRL',
      balances: {
        pendingMinor: '9000',
        heldMinor: '0',
        availableMinor: '0',
        reservedMinor: '0',
        deficitMinor: '0',
      },
    });
    expect(prisma.sellerProfile.findFirst).toHaveBeenCalledWith({
      where: { userId: 'user-a', status: 'ACTIVE' },
      select: { id: true },
    });
    expect(ledger.getSellerFinancialBalance).toHaveBeenCalledWith('seller-a');
  });

  it('rejects a user without an active persistent seller profile', async () => {
    prisma.sellerProfile.findFirst.mockResolvedValue(null);
    await expect(service.summary('buyer')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('derives liability and deficit movements from seller entries only', async () => {
    prisma.sellerProfile.findFirst.mockResolvedValue({ id: 'seller-a' });
    prisma.ledgerTransaction.findMany.mockResolvedValue([
      {
        id: 'tx',
        type: 'SELLER_FUNDS_RELEASED',
        referenceType: 'FinancialHoldRelease',
        referenceId: null,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        currency: 'BRL',
        entries: [
          {
            direction: 'DEBIT',
            amountMinor: 9000n,
            account: { purpose: 'SELLER_HELD', accountClass: 'LIABILITY' },
          },
          {
            direction: 'CREDIT',
            amountMinor: 9000n,
            account: { purpose: 'SELLER_AVAILABLE', accountClass: 'LIABILITY' },
          },
          {
            direction: 'DEBIT',
            amountMinor: 5n,
            account: { purpose: 'SELLER_DEFICIT', accountClass: 'ASSET' },
          },
        ],
      },
    ]);
    const result = await service.activity('user-a', { limit: 20 });
    expect(result.items[0].movements).toEqual({
      pendingMinor: '0',
      heldMinor: '-9000',
      availableMinor: '9000',
      reservedMinor: '0',
      deficitMinor: '5',
    });
    expect(prisma.ledgerTransaction.findMany).toHaveBeenCalledTimes(1);
  });
});
