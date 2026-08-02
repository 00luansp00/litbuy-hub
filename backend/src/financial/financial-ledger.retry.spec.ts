import { Prisma } from '@prisma/client';
import { FinancialLedgerService } from './financial-ledger.service';
import { FinancialDomainError } from './financial.errors';
const request = {
  type: 'TEST',
  currency: 'BRL' as const,
  idempotencyKeyHash: 'hash',
  entries: [
    {
      accountId: '00000000-0000-0000-0000-000000000001',
      direction: 'DEBIT' as const,
      amountMinor: 1n,
    },
    {
      accountId: '00000000-0000-0000-0000-000000000002',
      direction: 'CREDIT' as const,
      amountMinor: 1n,
    },
  ],
};
describe('FinancialLedgerService serialization retry', () => {
  it('retries the complete transaction only for P2034', async () => {
    const result = { id: 'posting', entries: [] };
    const transaction = jest
      .fn()
      .mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('write conflict', {
          code: 'P2034',
          clientVersion: 'test',
        }),
      )
      .mockResolvedValueOnce(result);
    const service = new FinancialLedgerService({ $transaction: transaction } as never);
    await expect(service.post(request)).resolves.toBe(result);
    expect(transaction).toHaveBeenCalledTimes(2);
  });
  it('does not retry domain or permanent errors', async () => {
    for (const error of [
      new FinancialDomainError('IDEMPOTENCY_KEY_REUSED'),
      new Prisma.PrismaClientKnownRequestError('constraint', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    ]) {
      const transaction = jest.fn().mockRejectedValue(error);
      const service = new FinancialLedgerService({ $transaction: transaction } as never);
      await expect(service.post(request)).rejects.toBe(error);
      expect(transaction).toHaveBeenCalledTimes(1);
    }
  });
  it('converts exhausted P2034 retries to a controlled financial error', async () => {
    const transaction = jest.fn().mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('write conflict', {
        code: 'P2034',
        clientVersion: 'test',
      }),
    );
    const service = new FinancialLedgerService({ $transaction: transaction } as never);
    await expect(service.post(request)).rejects.toMatchObject({
      code: 'FINANCIAL_CONCURRENCY_CONFLICT',
    });
    expect(transaction).toHaveBeenCalledTimes(3);
  });
});
