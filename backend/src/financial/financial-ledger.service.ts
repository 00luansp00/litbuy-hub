import { Injectable } from '@nestjs/common';
import {
  LedgerAccountClass,
  LedgerAccountPurpose,
  LedgerDirection,
  LedgerOwnerType,
  Prisma,
} from '@prisma/client';
import { canonicalRequestHash } from '../commerce/idempotency-key';
import { acquireAdvisoryTransactionLock } from '../database/advisory-lock';
import { PrismaService } from '../database/prisma.service';
import { FinancialDomainError } from './financial.errors';
const SELLER_PURPOSES = [
  LedgerAccountPurpose.SELLER_PENDING,
  LedgerAccountPurpose.SELLER_HELD,
  LedgerAccountPurpose.SELLER_AVAILABLE,
  LedgerAccountPurpose.SELLER_RESERVED,
  LedgerAccountPurpose.SELLER_DEFICIT,
] as const;
const CLASSES: Record<LedgerAccountPurpose, LedgerAccountClass> = {
  PROVIDER_CLEARING: 'ASSET',
  SELLER_PENDING: 'LIABILITY',
  SELLER_HELD: 'LIABILITY',
  SELLER_AVAILABLE: 'LIABILITY',
  SELLER_RESERVED: 'LIABILITY',
  SELLER_DEFICIT: 'ASSET',
  PLATFORM_COMMISSION: 'REVENUE',
  PLATFORM_WITHDRAWAL_FEE: 'REVENUE',
  PSP_FEE_EXPENSE: 'EXPENSE',
  BUYER_REFUND_CLEARING: 'LIABILITY',
  WITHDRAWAL_CLEARING: 'ASSET',
  CHARGEBACK_RESERVE: 'LIABILITY',
};
const PROTECTED = new Set<LedgerAccountPurpose>([
  'SELLER_PENDING',
  'SELLER_HELD',
  'SELLER_AVAILABLE',
  'SELLER_RESERVED',
]);
type PostingEntry = { accountId: string; direction: LedgerDirection; amountMinor: bigint };
export type PostRequest = {
  type: string;
  currency: 'BRL';
  idempotencyKeyHash: string;
  referenceType?: string;
  referenceId?: string;
  entries: PostingEntry[];
  emitOutbox?: boolean;
  metadata?: Record<string, string | boolean | null>;
};
type PostedTransaction = Prisma.LedgerTransactionGetPayload<{ include: { entries: true } }>;
export type PostOutcome = { transaction: PostedTransaction; created: boolean };
@Injectable()
export class FinancialLedgerService {
  constructor(private readonly prisma: PrismaService) {}
  async ensureSellerLedgerAccounts(sellerProfileId: string) {
    return this.ensureAccounts('SELLER', sellerProfileId, SELLER_PURPOSES);
  }
  async ensureSystemLedgerAccounts() {
    return this.ensureAccounts('SYSTEM', 'LIT_BUY_SYSTEM', [
      LedgerAccountPurpose.PROVIDER_CLEARING,
      LedgerAccountPurpose.BUYER_REFUND_CLEARING,
      LedgerAccountPurpose.WITHDRAWAL_CLEARING,
      LedgerAccountPurpose.CHARGEBACK_RESERVE,
    ]);
  }
  async ensurePlatformLedgerAccounts() {
    return this.ensureAccounts('PLATFORM', 'LIT_BUY_PLATFORM', [
      LedgerAccountPurpose.PLATFORM_COMMISSION,
      LedgerAccountPurpose.PLATFORM_WITHDRAWAL_FEE,
      LedgerAccountPurpose.PSP_FEE_EXPENSE,
    ]);
  }
  private async ensureAccounts(
    ownerType: LedgerOwnerType,
    ownerId: string,
    purposes: readonly LedgerAccountPurpose[],
  ) {
    return this.prisma.$transaction(async (tx) => {
      await acquireAdvisoryTransactionLock(tx, `financial:accounts:${ownerType}:${ownerId}`);
      for (const purpose of purposes)
        await tx.ledgerAccount.upsert({
          where: {
            ownerType_ownerId_purpose_currency: { ownerType, ownerId, purpose, currency: 'BRL' },
          },
          create: {
            ownerType,
            ownerId,
            sellerProfileId: ownerType === 'SELLER' ? ownerId : null,
            purpose,
            currency: 'BRL',
            accountClass: CLASSES[purpose],
          },
          update: {},
        });
      return tx.ledgerAccount.findMany({ where: { ownerType, ownerId, currency: 'BRL' } });
    });
  }
  async getSellerFinancialBalance(sellerProfileId: string) {
    const accounts = await this.ensureSellerLedgerAccounts(sellerProfileId);
    const ids = accounts.map((a) => a.id);
    const grouped = await this.prisma.ledgerEntry.groupBy({
      by: ['accountId', 'direction'],
      where: { accountId: { in: ids } },
      _sum: { amountMinor: true },
    });
    const values = new Map(accounts.map((a) => [a.purpose, 0n]));
    for (const row of grouped) {
      const account = accounts.find((a) => a.id === row.accountId)!;
      const amount = row._sum.amountMinor ?? 0n;
      const sign =
        account.accountClass === 'LIABILITY'
          ? row.direction === 'CREDIT'
            ? 1n
            : -1n
          : row.direction === 'DEBIT'
            ? 1n
            : -1n;
      values.set(account.purpose, (values.get(account.purpose) ?? 0n) + sign * amount);
    }
    return {
      pending: values.get('SELLER_PENDING')!,
      held: values.get('SELLER_HELD')!,
      available: values.get('SELLER_AVAILABLE')!,
      reserved: values.get('SELLER_RESERVED')!,
      deficit: values.get('SELLER_DEFICIT')!,
      currency: 'BRL' as const,
    };
  }
  async post(request: PostRequest) {
    return (await this.postWithOutcome(request)).transaction;
  }

  async postWithOutcome(request: PostRequest): Promise<PostOutcome> {
    this.validateRequest(request);
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        return await this.prisma.$transaction(
          (tx) => this.postWithOutcomeInTransaction(tx, request),
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (!this.isRetryableSerializationConflict(error)) throw error;
        if (attempt === 3) throw new FinancialDomainError('FINANCIAL_CONCURRENCY_CONFLICT');
      }
    }
    throw new FinancialDomainError('FINANCIAL_CONCURRENCY_CONFLICT');
  }

  async postWithOutcomeInTransaction(
    tx: Prisma.TransactionClient,
    request: PostRequest,
  ): Promise<PostOutcome> {
    this.validateRequest(request);
    const requestHash = canonicalRequestHash({
      ...request,
      entries: request.entries.map((entry) => ({
        ...entry,
        amountMinor: entry.amountMinor.toString(),
      })),
    });
    await acquireAdvisoryTransactionLock(tx, `financial:idempotency:${request.idempotencyKeyHash}`);
    const prior = await tx.ledgerTransaction.findUnique({
      where: { idempotencyKeyHash: request.idempotencyKeyHash },
      include: { entries: true },
    });
    if (prior) {
      if (prior.requestHash !== requestHash)
        throw new FinancialDomainError('IDEMPOTENCY_KEY_REUSED');
      return { transaction: prior, created: false };
    }
    const accountIds = [...new Set(request.entries.map((entry) => entry.accountId))].sort();
    for (const id of accountIds)
      await acquireAdvisoryTransactionLock(tx, `financial:account:${id}`);
    const accounts = await tx.ledgerAccount.findMany({ where: { id: { in: accountIds } } });
    if (
      accounts.length !== accountIds.length ||
      accounts.some((account) => account.currency !== request.currency)
    )
      throw new FinancialDomainError('INVALID_MONEY');
    for (const account of accounts.filter((candidate) => PROTECTED.has(candidate.purpose))) {
      const debits = request.entries
        .filter((entry) => entry.accountId === account.id && entry.direction === 'DEBIT')
        .reduce((sum, entry) => sum + entry.amountMinor, 0n);
      if (!debits) continue;
      const rows = await tx.ledgerEntry.groupBy({
        by: ['direction'],
        where: { accountId: account.id },
        _sum: { amountMinor: true },
      });
      const balance = rows.reduce(
        (sum, row) => sum + (row.direction === 'CREDIT' ? 1n : -1n) * (row._sum.amountMinor ?? 0n),
        0n,
      );
      const credits = request.entries
        .filter((entry) => entry.accountId === account.id && entry.direction === 'CREDIT')
        .reduce((sum, entry) => sum + entry.amountMinor, 0n);
      if (balance + credits - debits < 0n)
        throw new FinancialDomainError('INSUFFICIENT_FINANCIAL_BALANCE');
    }
    const transaction = await tx.ledgerTransaction.create({
      data: {
        currency: request.currency,
        type: request.type,
        referenceType: request.referenceType,
        referenceId: request.referenceId,
        idempotencyKeyHash: request.idempotencyKeyHash,
        requestHash,
        metadata: request.metadata ?? {},
      },
    });
    await tx.ledgerEntry.createMany({
      data: request.entries.map((entry) => ({ ...entry, transactionId: transaction.id })),
    });
    const event = await tx.financialEvent.create({
      data: {
        ledgerTransactionId: transaction.id,
        type: request.type,
        aggregateType: request.referenceType ?? 'LEDGER_TRANSACTION',
        aggregateId: request.referenceId ?? transaction.id,
        metadata: request.metadata ?? {},
      },
    });
    if (request.emitOutbox)
      await tx.financialOutboxEvent.create({
        data: {
          financialEventId: event.id,
          eventType: request.type,
          payload: { ledgerTransactionId: transaction.id },
        },
      });
    return {
      transaction: await tx.ledgerTransaction.findUniqueOrThrow({
        where: { id: transaction.id },
        include: { entries: true },
      }),
      created: true,
    };
  }

  private validateRequest(request: PostRequest): void {
    if (
      request.currency !== 'BRL' ||
      request.entries.length < 2 ||
      request.entries.some((e) => e.amountMinor <= 0n)
    )
      throw new FinancialDomainError('INVALID_MONEY');
  }
  private isRetryableSerializationConflict(error: unknown): boolean {
    return (
      !(error instanceof FinancialDomainError) &&
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2034'
    );
  }
}
