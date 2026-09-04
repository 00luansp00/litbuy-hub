import { Injectable } from '@nestjs/common';
import { DisputeCaseStatus, Prisma } from '@prisma/client';

export const DISPUTE_RELEASE_BLOCKING_STATUSES = [
  DisputeCaseStatus.OPEN,
  DisputeCaseStatus.UNDER_REVIEW,
  DisputeCaseStatus.RESOLVED_BUYER,
  DisputeCaseStatus.CLOSED,
] as const;

@Injectable()
export class DisputeReleaseBlockerService {
  async hasPersistentBlocker(tx: Prisma.TransactionClient, orderId: string): Promise<boolean> {
    const blocker = await tx.disputeCase.findFirst({
      where: { orderId, status: { in: [...DISPUTE_RELEASE_BLOCKING_STATUSES] } },
      select: { id: true },
    });
    return blocker !== null;
  }
}
