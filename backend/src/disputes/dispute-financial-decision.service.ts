import { Injectable } from '@nestjs/common';
import { DisputeFinancialDecisionType, Prisma } from '@prisma/client';
import { AppError } from '../common/errors/app-error';
import { canonicalRequestHash, parseIdempotencyKey } from '../commerce/idempotency-key';
import { acquireAdvisoryTransactionLock } from '../database/advisory-lock';
import { PrismaService } from '../database/prisma.service';
import { isSerializationFailure } from '../financial/serialization-failure';

export type CreatePostReleaseBuyerDecisionInput = Readonly<{
  actorUserId: string;
  disputeCaseId: string;
  decisionType: DisputeFinancialDecisionType;
  decidedPrincipalAmountMinor: bigint;
  idempotencyKey: unknown;
}>;

@Injectable()
export class DisputeFinancialDecisionService {
  constructor(private readonly prisma: PrismaService) {}

  async createPostReleaseBuyerDecision(input: CreatePostReleaseBuyerDecisionInput) {
    const key = parseIdempotencyKey(input.idempotencyKey);
    if (!Object.values(DisputeFinancialDecisionType).includes(input.decisionType))
      throw new AppError('FINANCIAL_DECISION_INVALID', 'FINANCIAL_DECISION_INVALID', 400);
    if (typeof input.decidedPrincipalAmountMinor !== 'bigint')
      throw new AppError('FINANCIAL_DECISION_INVALID', 'FINANCIAL_DECISION_INVALID', 400);
    const requestHash = canonicalRequestHash({
      decidedPrincipalAmountMinor: input.decidedPrincipalAmountMinor.toString(),
      decisionType: input.decisionType,
      disputeCaseId: input.disputeCaseId,
    });

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        return await this.prisma.$transaction(
          (tx) => this.createInTransaction(tx, input, key.hash, requestHash),
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (isSerializationFailure(error) && attempt < 3) continue;
        if (this.isUniqueConflict(error)) {
          const replay = await this.prisma.disputeFinancialDecision.findUnique({
            where: {
              createdByUserId_idempotencyKeyHash: {
                createdByUserId: input.actorUserId,
                idempotencyKeyHash: key.hash,
              },
            },
          });
          if (replay?.requestHash === requestHash) return replay;
        }
        throw this.toDomainError(error);
      }
    }
    throw new Error('unreachable');
  }

  private async createInTransaction(
    tx: Prisma.TransactionClient,
    input: CreatePostReleaseBuyerDecisionInput,
    keyHash: string,
    requestHash: string,
  ) {
    await acquireAdvisoryTransactionLock(
      tx,
      `dispute-financial-decision:idempotency:${input.actorUserId}:${keyHash}`,
    );
    const replay = await tx.disputeFinancialDecision.findUnique({
      where: {
        createdByUserId_idempotencyKeyHash: {
          createdByUserId: input.actorUserId,
          idempotencyKeyHash: keyHash,
        },
      },
    });
    if (replay) {
      if (replay.requestHash !== requestHash)
        throw new AppError('IDEMPOTENCY_KEY_REUSED', 'IDEMPOTENCY_KEY_REUSED', 409);
      return replay;
    }
    const actor = await tx.userRoleAssignment.findUnique({
      where: { userId_role: { userId: input.actorUserId, role: 'ADMIN' } },
      select: { userId: true },
    });
    if (!actor)
      throw new AppError(
        'FINANCIAL_DECISION_ADMIN_REQUIRED',
        'FINANCIAL_DECISION_ADMIN_REQUIRED',
        403,
      );
    const cases = await tx.$queryRaw<
      Array<{ id: string; orderId: string; status: string; terminalAt: Date | null }>
    >`SELECT id, "orderId", status, "terminalAt" FROM "DisputeCase" WHERE id = ${input.disputeCaseId}::uuid FOR SHARE`;
    const dispute = cases[0];
    if (!dispute) throw new AppError('DISPUTE_CASE_NOT_FOUND', 'DISPUTE_CASE_NOT_FOUND', 404);
    const orders = await tx.$queryRaw<
      Array<{
        id: string;
        buyerUserId: string;
        sellerProfileId: string;
        currency: string;
        subtotalAmountMinor: bigint;
        discountAmountMinor: bigint;
      }>
    >`SELECT id, "buyerUserId", "sellerProfileId", currency, "subtotalAmountMinor", "discountAmountMinor" FROM "Order" WHERE id = ${dispute.orderId}::uuid FOR UPDATE`;
    const order = orders[0];
    if (!order || dispute.status !== 'RESOLVED_BUYER' || !dispute.terminalAt)
      throw new AppError(
        'FINANCIAL_DECISION_DISPUTE_INELIGIBLE',
        'FINANCIAL_DECISION_DISPUTE_INELIGIBLE',
        409,
      );
    if (await tx.disputeFinancialDecision.findUnique({ where: { disputeCaseId: dispute.id } }))
      throw new AppError(
        'FINANCIAL_DECISION_ALREADY_EXISTS',
        'FINANCIAL_DECISION_ALREADY_EXISTS',
        409,
      );
    const principal = order.subtotalAmountMinor - order.discountAmountMinor;
    const amount = input.decidedPrincipalAmountMinor;
    const validShape =
      input.decisionType === 'TOTAL' ? amount === principal : amount > 0n && amount < principal;
    if (order.currency !== 'BRL' || principal <= 0n || !validShape)
      throw new AppError(
        'FINANCIAL_DECISION_INVALID_AMOUNT',
        'FINANCIAL_DECISION_INVALID_AMOUNT',
        400,
      );
    const release = await tx.financialHold.findFirst({
      where: {
        orderId: order.id,
        sellerProfileId: order.sellerProfileId,
        reason: 'DELIVERY_PROTECTION',
        status: 'RELEASED',
        amountMinor: { gt: 0 },
        releasedAt: { not: null },
        releaseLedgerTransactionId: { not: null },
      },
      select: { id: true },
    });
    if (!release)
      throw new AppError(
        'FINANCIAL_DECISION_POST_RELEASE_REQUIRED',
        'FINANCIAL_DECISION_POST_RELEASE_REQUIRED',
        409,
      );
    const aggregate = await tx.disputeFinancialDecision.aggregate({
      where: { orderId: order.id },
      _sum: { decidedPrincipalAmountMinor: true },
    });
    if ((aggregate._sum.decidedPrincipalAmountMinor ?? 0n) + amount > principal)
      throw new AppError(
        'FINANCIAL_DECISION_CUMULATIVE_LIMIT_EXCEEDED',
        'FINANCIAL_DECISION_CUMULATIVE_LIMIT_EXCEEDED',
        409,
      );
    return tx.disputeFinancialDecision.create({
      data: {
        disputeCaseId: dispute.id,
        orderId: order.id,
        buyerUserId: order.buyerUserId,
        sellerProfileId: order.sellerProfileId,
        decisionType: input.decisionType,
        orderPrincipalSnapshotMinor: principal,
        decidedPrincipalAmountMinor: amount,
        currency: 'BRL',
        createdByUserId: input.actorUserId,
        idempotencyKeyHash: keyHash,
        requestHash,
      },
    });
  }

  private toDomainError(error: unknown): unknown {
    if (error instanceof AppError) return error;
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
      return new AppError(
        'FINANCIAL_DECISION_ALREADY_EXISTS',
        'FINANCIAL_DECISION_ALREADY_EXISTS',
        409,
      );
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2010') {
      const message =
        typeof error.meta?.message === 'string' ? error.meta.message : JSON.stringify(error.meta);
      return new AppError(
        message.includes('cumulative principal exceeded')
          ? 'FINANCIAL_DECISION_CUMULATIVE_LIMIT_EXCEEDED'
          : 'FINANCIAL_DECISION_INVARIANT_VIOLATION',
        message.includes('cumulative principal exceeded')
          ? 'FINANCIAL_DECISION_CUMULATIVE_LIMIT_EXCEEDED'
          : 'FINANCIAL_DECISION_INVARIANT_VIOLATION',
        409,
      );
    }
    return error;
  }

  private isUniqueConflict(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }
}
