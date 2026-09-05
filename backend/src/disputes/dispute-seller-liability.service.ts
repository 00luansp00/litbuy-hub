import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AppError } from '../common/errors/app-error';
import { PrismaService } from '../database/prisma.service';
import { isSerializationFailure } from '../financial/serialization-failure';

export function cumulativeFeeAllocation(
  frozenFee: bigint,
  priorPrincipal: bigint,
  currentPrincipal: bigint,
  originalPrincipal: bigint,
): bigint {
  return (
    (frozenFee * (priorPrincipal + currentPrincipal)) / originalPrincipal -
    (frozenFee * priorPrincipal) / originalPrincipal
  );
}

@Injectable()
export class DisputeSellerLiabilityService {
  constructor(private readonly prisma: PrismaService) {}

  async createForFinancialDecision(disputeFinancialDecisionId: string) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        return await this.prisma.$transaction(
          (tx) => this.createInTransaction(tx, disputeFinancialDecisionId),
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (isSerializationFailure(error) && attempt < 3) continue;
        throw this.toDomainError(error);
      }
    }
    throw new Error('unreachable');
  }

  private async createInTransaction(tx: Prisma.TransactionClient, decisionId: string) {
    const decision = await tx.disputeFinancialDecision.findUnique({ where: { id: decisionId } });
    if (!decision)
      throw new AppError(
        'SELLER_LIABILITY_DECISION_NOT_FOUND',
        'SELLER_LIABILITY_DECISION_NOT_FOUND',
        404,
      );

    // Order is the sole per-order serialization boundary, matching AA0 and the DB trigger.
    await tx.$queryRaw`SELECT id FROM "Order" WHERE id=${decision.orderId}::uuid FOR UPDATE`;
    const replay = await tx.disputeSellerLiability.findUnique({
      where: { disputeFinancialDecisionId: decision.id },
      include: { feeComponents: true },
    });
    if (replay) return replay;

    const order = await tx.order.findUnique({
      where: { id: decision.orderId },
      include: { feeComponentSnapshots: { orderBy: { id: 'asc' } } },
    });
    if (
      !order ||
      order.buyerUserId !== decision.buyerUserId ||
      order.sellerProfileId !== decision.sellerProfileId
    )
      throw new AppError(
        'SELLER_LIABILITY_AUTHORITY_MISMATCH',
        'SELLER_LIABILITY_AUTHORITY_MISMATCH',
        409,
      );
    if (order.feeSnapshotVersion === null)
      throw new AppError(
        'SELLER_LIABILITY_LEGACY_FEE_UNRESOLVED',
        'SELLER_LIABILITY_LEGACY_FEE_UNRESOLVED',
        409,
      );
    if (
      ![1, 2, 3].includes(order.feeSnapshotVersion) ||
      decision.currency !== 'BRL' ||
      decision.orderPrincipalSnapshotMinor !== order.subtotalAmountMinor - order.discountAmountMinor
    )
      throw new AppError(
        'SELLER_LIABILITY_SNAPSHOT_INCOHERENT',
        'SELLER_LIABILITY_SNAPSHOT_INCOHERENT',
        409,
      );

    const sellerComponents = order.feeComponentSnapshots.filter(
      (component) =>
        component.componentKind === 'LISTING_TIER' || component.componentKind === 'SELLER_MAX',
    );
    const listingCount = sellerComponents.filter((x) => x.componentKind === 'LISTING_TIER').length;
    const maxCount = sellerComponents.filter((x) => x.componentKind === 'SELLER_MAX').length;
    const vipCount = order.feeComponentSnapshots.filter(
      (x) => x.componentKind === 'BUYER_VIP',
    ).length;
    const expectedMax =
      order.feeSnapshotVersion >= 2 && order.sellerPlanSnapshot === 'LIT_MAX' ? 1 : 0;
    const expectedVip =
      order.feeSnapshotVersion === 3 &&
      ['BASIC', 'PREMIUM'].includes(order.buyerVipPlanSnapshot ?? '')
        ? 1
        : 0;
    if (
      listingCount !== 1 ||
      maxCount !== expectedMax ||
      vipCount !== expectedVip ||
      sellerComponents.some(
        (x) =>
          x.partyCharged !== 'SELLER' ||
          x.formula !== 'PERCENT_BPS' ||
          x.currency !== decision.currency ||
          x.baseAmountMinor !== decision.orderPrincipalSnapshotMinor ||
          x.feeAmountMinor < 0n,
      )
    )
      throw new AppError(
        'SELLER_LIABILITY_SNAPSHOT_INCOHERENT',
        'SELLER_LIABILITY_SNAPSHOT_INCOHERENT',
        409,
      );

    const prior = await tx.disputeFinancialDecision.aggregate({
      where: {
        orderId: decision.orderId,
        OR: [
          { executableAt: { lt: decision.executableAt } },
          { executableAt: decision.executableAt, id: { lt: decision.id } },
        ],
      },
      _sum: { decidedPrincipalAmountMinor: true },
    });
    const priorPrincipal = prior._sum.decidedPrincipalAmountMinor ?? 0n;
    const allocations = sellerComponents.map((component) => ({
      component,
      amount: cumulativeFeeAllocation(
        component.feeAmountMinor,
        priorPrincipal,
        decision.decidedPrincipalAmountMinor,
        decision.orderPrincipalSnapshotMinor,
      ),
    }));
    const reversal = allocations.reduce((sum, item) => sum + item.amount, 0n);
    if (reversal < 0n || reversal > decision.decidedPrincipalAmountMinor)
      throw new AppError('SELLER_LIABILITY_INVALID_AMOUNT', 'SELLER_LIABILITY_INVALID_AMOUNT', 409);

    return tx.disputeSellerLiability.create({
      data: {
        disputeFinancialDecisionId: decision.id,
        disputeCaseId: decision.disputeCaseId,
        orderId: decision.orderId,
        buyerUserId: decision.buyerUserId,
        sellerProfileId: decision.sellerProfileId,
        decisionPrincipalAmountMinor: decision.decidedPrincipalAmountMinor,
        reversiblePlatformSellerFeeRequiredAmountMinor: reversal,
        sellerLiabilityAmountMinor: decision.decidedPrincipalAmountMinor - reversal,
        currency: decision.currency,
        feeComponents: {
          create: allocations.map(({ component, amount }) => ({
            orderFeeComponentSnapshotId: component.id,
            componentKind: component.componentKind,
            originalFrozenFeeAmountMinor: component.feeAmountMinor,
            reversalRequiredAmountMinor: amount,
          })),
        },
      },
      include: { feeComponents: true },
    });
  }

  private toDomainError(error: unknown): unknown {
    if (error instanceof AppError) return error;
    const message =
      error instanceof Prisma.PrismaClientKnownRequestError &&
      typeof error.meta?.message === 'string'
        ? error.meta.message
        : '';
    if (message.includes('SELLER_LIABILITY_LEGACY_FEE_UNRESOLVED'))
      return new AppError(
        'SELLER_LIABILITY_LEGACY_FEE_UNRESOLVED',
        'SELLER_LIABILITY_LEGACY_FEE_UNRESOLVED',
        409,
      );
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      ['P2002', 'P2010'].includes(error.code)
    )
      return new AppError(
        'SELLER_LIABILITY_INVARIANT_VIOLATION',
        'SELLER_LIABILITY_INVARIANT_VIOLATION',
        409,
      );
    return error;
  }
}
