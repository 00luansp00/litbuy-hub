import { ConflictException, Injectable } from '@nestjs/common';
import { LitPointsBucket } from '@prisma/client';
import { canonicalRequestHash } from '../commerce/idempotency-key';
import { acquireAdvisoryTransactionLock } from '../database/advisory-lock';
import { PrismaService } from '../database/prisma.service';

export type LitPointsPosting = {
  userId: string;
  operationKey: string;
  operation: string;
  source: string;
  sourceReference: string;
  entries: Array<{ bucket: LitPointsBucket; delta: bigint }>;
};

@Injectable()
export class LitPointsLedgerService {
  constructor(private readonly prisma: PrismaService) {}

  /** Internal domain writer. No HTTP mutation route exposes this method. */
  async append(posting: LitPointsPosting) {
    this.validatePosting(posting);
    const requestHash = canonicalRequestHash({
      ...posting,
      entries: posting.entries.map((entry) => ({ ...entry, delta: entry.delta.toString() })),
    });
    return this.prisma.$transaction(async (tx) => {
      await acquireAdvisoryTransactionLock(tx, `litpoints:operation:${posting.operationKey}`);
      const prior = await tx.litPointsLedgerTransaction.findUnique({
        where: { operationKey: posting.operationKey },
        include: { entries: true },
      });
      if (prior) {
        if (prior.requestHash !== requestHash)
          throw new ConflictException({ code: 'LITPOINTS_OPERATION_KEY_REUSED' });
        return { transaction: prior, created: false };
      }
      const transaction = await tx.litPointsLedgerTransaction.create({
        data: {
          userId: posting.userId,
          operationKey: posting.operationKey,
          operation: posting.operation,
          source: posting.source,
          sourceReference: posting.sourceReference,
          requestHash,
        },
      });
      await tx.litPointsLedgerEntry.createMany({
        data: posting.entries.map((entry) => ({
          transactionId: transaction.id,
          userId: posting.userId,
          ...entry,
        })),
      });
      return {
        transaction: await tx.litPointsLedgerTransaction.findUniqueOrThrow({
          where: { id: transaction.id },
          include: { entries: true },
        }),
        created: true,
      };
    });
  }

  async balance(userId: string) {
    const grouped = await this.prisma.litPointsLedgerEntry.groupBy({
      by: ['bucket'],
      where: { userId },
      _sum: { delta: true },
    });
    const sum = (bucket: LitPointsBucket) =>
      grouped.find((row) => row.bucket === bucket)?._sum.delta ?? 0n;
    return { pending: sum('PENDING').toString(), available: sum('AVAILABLE').toString() };
  }

  async history(userId: string, limit: number, cursor?: string) {
    const cursorEntry = cursor
      ? await this.prisma.litPointsLedgerEntry.findFirst({ where: { id: cursor, userId } })
      : null;
    if (cursor && !cursorEntry) return { items: [], nextCursor: null };
    const entries = await this.prisma.litPointsLedgerEntry.findMany({
      where: {
        userId,
        ...(cursorEntry
          ? {
              OR: [
                { createdAt: { lt: cursorEntry.createdAt } },
                { createdAt: cursorEntry.createdAt, id: { lt: cursorEntry.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      include: {
        transaction: {
          select: { operation: true, source: true, sourceReference: true },
        },
      },
    });
    const hasMore = entries.length > limit;
    const page = entries.slice(0, limit);
    return {
      items: page.map(({ transaction, ...entry }) => ({
        id: entry.id,
        bucket: entry.bucket,
        delta: entry.delta.toString(),
        operation: transaction.operation,
        source: transaction.source,
        sourceReference: transaction.sourceReference,
        createdAt: entry.createdAt.toISOString(),
      })),
      nextCursor: hasMore ? page.at(-1)!.id : null,
    };
  }

  private validatePosting(posting: LitPointsPosting): void {
    const required = [
      posting.userId,
      posting.operationKey,
      posting.operation,
      posting.source,
      posting.sourceReference,
    ];
    if (!posting.entries.length || required.some((value) => !value.trim()))
      throw new TypeError('Invalid LIT Points posting');
    if (posting.entries.some((entry) => entry.delta === 0n))
      throw new TypeError('LIT Points entries require a non-zero integer delta');
  }
}
