import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DisputeCaseStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

const transitions: Readonly<Record<DisputeCaseStatus, readonly DisputeCaseStatus[]>> = {
  OPEN: [
    DisputeCaseStatus.UNDER_REVIEW,
    DisputeCaseStatus.RESOLVED_BUYER,
    DisputeCaseStatus.RESOLVED_SELLER,
    DisputeCaseStatus.CLOSED,
  ],
  UNDER_REVIEW: [
    DisputeCaseStatus.RESOLVED_BUYER,
    DisputeCaseStatus.RESOLVED_SELLER,
    DisputeCaseStatus.CLOSED,
  ],
  RESOLVED_BUYER: [],
  RESOLVED_SELLER: [],
  CLOSED: [],
};

@Injectable()
export class DisputeCoreService {
  constructor(private readonly prisma: PrismaService) {}

  async createCase(input: { orderId: string; actorUserId?: string }) {
    try {
      return await this.prisma.disputeCase.create({
        data: { orderId: input.orderId, mutationActorId: input.actorUserId },
        include: { events: true },
      });
    } catch (error) {
      this.rethrowIntegrity(error, input.orderId);
    }
  }

  async transition(input: { caseId: string; toStatus: DisputeCaseStatus; actorUserId?: string }) {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ status: DisputeCaseStatus }>>`
        SELECT status FROM "DisputeCase" WHERE id = ${input.caseId}::uuid FOR UPDATE
      `;
      const current = rows[0]?.status;
      if (!current) throw new NotFoundException('Dispute case not found');
      if (!transitions[current].includes(input.toStatus)) {
        throw new BadRequestException(
          `Invalid dispute transition: ${current} -> ${input.toStatus}`,
        );
      }
      return tx.disputeCase.update({
        where: { id: input.caseId },
        data: { status: input.toStatus, mutationActorId: input.actorUserId ?? null },
        include: { events: { orderBy: { createdAt: 'asc' } } },
      });
    });
  }

  private rethrowIntegrity(error: unknown, orderId: string): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      throw new NotFoundException(`Order not found: ${orderId}`);
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException('Order already has an active dispute case');
    }
    throw error;
  }
}
