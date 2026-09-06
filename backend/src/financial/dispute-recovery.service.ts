import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AppError } from '../common/errors/app-error';
import { sha256 } from '../commerce/idempotency-key';
import { PrismaService } from '../database/prisma.service';
import { isSerializationFailure } from './serialization-failure';
import { FinancialLedgerService } from './financial-ledger.service';

export type DisputeRecoveryResult =
  | { outcome: 'ZERO_SELLER_LIABILITY'; disputeSellerLiabilityId: string }
  | {
      outcome: 'CLAIM';
      claimId: string;
      claimAmountMinor: bigint;
      reservedAmountMinor: bigint;
      unfundedAmountMinor: bigint;
      priorityAt: Date;
      status: 'UNFUNDED' | 'PARTIALLY_FUNDED' | 'FUNDED';
    };

@Injectable()
export class DisputeRecoveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: FinancialLedgerService,
  ) {}

  async processForLiability(disputeSellerLiabilityId: string): Promise<DisputeRecoveryResult> {
    const authority = await this.prisma.disputeSellerLiability.findUnique({
      where: { id: disputeSellerLiabilityId },
      select: { sellerProfileId: true, sellerLiabilityAmountMinor: true },
    });
    if (!authority)
      throw new AppError('RECOVERY_LIABILITY_NOT_FOUND', 'RECOVERY_LIABILITY_NOT_FOUND', 404);
    if (authority.sellerLiabilityAmountMinor === 0n)
      return { outcome: 'ZERO_SELLER_LIABILITY', disputeSellerLiabilityId };

    // Provisioning precedes the Seller lock; queue execution itself never reverses this lock order.
    await this.ledger.ensureSellerLedgerAccounts(authority.sellerProfileId);
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        return await this.prisma.$transaction(
          (tx) => this.processSellerQueue(tx, authority.sellerProfileId, disputeSellerLiabilityId),
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (isSerializationFailure(error) && attempt < 3) continue;
        if (isSerializationFailure(error))
          throw new AppError('RECOVERY_CONCURRENCY_CONFLICT', 'RECOVERY_CONCURRENCY_CONFLICT', 409);
        throw error;
      }
    }
    throw new Error('unreachable');
  }

  private async processSellerQueue(
    tx: Prisma.TransactionClient,
    sellerProfileId: string,
    requestedLiabilityId: string,
  ): Promise<DisputeRecoveryResult> {
    // Common FIFO boundary: Seller -> ordered authorities -> canonical Ledger account locks.
    await tx.$queryRaw`SELECT id FROM "SellerProfile" WHERE id=${sellerProfileId}::uuid FOR UPDATE`;

    const liabilities = await tx.disputeSellerLiability.findMany({
      where: { sellerProfileId, sellerLiabilityAmountMinor: { gt: 0 } },
      include: { financialDecision: true, recoveryClaim: true },
      orderBy: [
        { financialDecision: { executableAt: 'asc' } },
        { disputeFinancialDecisionId: 'asc' },
      ],
    });
    for (const liability of liabilities) {
      if (liability.recoveryClaim) continue;
      await tx.disputeRecoveryClaim.create({
        data: {
          disputeSellerLiabilityId: liability.id,
          disputeFinancialDecisionId: liability.disputeFinancialDecisionId,
          disputeCaseId: liability.disputeCaseId,
          orderId: liability.orderId,
          buyerUserId: liability.buyerUserId,
          sellerProfileId: liability.sellerProfileId,
          claimAmountMinor: liability.sellerLiabilityAmountMinor,
          currency: liability.currency,
          priorityAt: liability.financialDecision.executableAt,
          prioritySourceId: liability.financialDecision.id,
        },
      });
    }

    const accounts = await tx.ledgerAccount.findMany({
      where: {
        ownerType: 'SELLER',
        ownerId: sellerProfileId,
        currency: 'BRL',
        purpose: { in: ['SELLER_AVAILABLE', 'SELLER_RESERVED'] },
      },
    });
    const availableAccount = accounts.find((account) => account.purpose === 'SELLER_AVAILABLE');
    const reservedAccount = accounts.find((account) => account.purpose === 'SELLER_RESERVED');
    if (!availableAccount || !reservedAccount)
      throw new AppError(
        'RECOVERY_LEDGER_ACCOUNTS_MISSING',
        'RECOVERY_LEDGER_ACCOUNTS_MISSING',
        409,
      );
    const balanceRows = await tx.ledgerEntry.groupBy({
      by: ['direction'],
      where: { accountId: availableAccount.id },
      _sum: { amountMinor: true },
    });
    let available = balanceRows.reduce(
      (sum, row) => sum + (row.direction === 'CREDIT' ? 1n : -1n) * (row._sum.amountMinor ?? 0n),
      0n,
    );

    const claims = await tx.disputeRecoveryClaim.findMany({
      where: { sellerProfileId },
      include: { reservations: true },
      orderBy: [{ priorityAt: 'asc' }, { prioritySourceId: 'asc' }],
    });
    for (const claim of claims) {
      const funded = claim.reservations.reduce((sum, item) => sum + item.amountMinor, 0n);
      const remaining = claim.claimAmountMinor - funded;
      if (remaining <= 0n) continue;
      // A partial initial allocation remains at the head for future funding capabilities.
      if (claim.reservations.length > 0 || available <= 0n) break;
      const amount = remaining < available ? remaining : available;
      const outcome = await this.ledger.postWithOutcomeInTransaction(tx, {
        type: 'DISPUTE_RECOVERY_RESERVED',
        currency: 'BRL',
        idempotencyKeyHash: sha256(`dispute-recovery-reservation:${claim.id}:initial-available`),
        referenceType: 'DisputeRecoveryClaim',
        referenceId: claim.id,
        entries: [
          { accountId: availableAccount.id, direction: 'DEBIT', amountMinor: amount },
          { accountId: reservedAccount.id, direction: 'CREDIT', amountMinor: amount },
        ],
        emitOutbox: true,
        metadata: { fundingSource: 'AVAILABLE_BALANCE', sellerProfileId },
      });
      await tx.disputeRecoveryReservation.create({
        data: {
          recoveryClaimId: claim.id,
          sellerProfileId,
          ledgerTransactionId: outcome.transaction.id,
          amountMinor: amount,
          fundingSource: 'AVAILABLE_BALANCE',
        },
      });
      available -= amount;
      if (amount < remaining) break;
    }

    const requested = await tx.disputeRecoveryClaim.findUniqueOrThrow({
      where: { disputeSellerLiabilityId: requestedLiabilityId },
      include: { reservations: true },
    });
    const reservedAmountMinor = requested.reservations.reduce(
      (sum, reservation) => sum + reservation.amountMinor,
      0n,
    );
    const unfundedAmountMinor = requested.claimAmountMinor - reservedAmountMinor;
    return {
      outcome: 'CLAIM',
      claimId: requested.id,
      claimAmountMinor: requested.claimAmountMinor,
      reservedAmountMinor,
      unfundedAmountMinor,
      priorityAt: requested.priorityAt,
      status:
        reservedAmountMinor === 0n
          ? 'UNFUNDED'
          : unfundedAmountMinor === 0n
            ? 'FUNDED'
            : 'PARTIALLY_FUNDED',
    };
  }
}
