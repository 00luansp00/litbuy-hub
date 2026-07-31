import { Injectable } from '@nestjs/common';
import {
  CommerceIdempotencyOperation,
  InventoryReservationStatus,
  OrderEventType,
  OrderStatus,
  OutboxEventStatus,
  PaymentStatus,
  Prisma,
  SecurityEventOutcome,
  SecurityEventType,
} from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AppError } from '../common/errors/app-error';
import { canonicalRequestHash, sha256 } from '../commerce/idempotency-key';
import { mapOrder } from './order-read.mapper';
import type { CancelOrderDto, OrderListQueryDto } from './orders.dto';
const include = {
  sellerProfile: { select: { slug: true, storeName: true } },
  items: { orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }] },
};
@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}
  async list(userId: string, q: OrderListQueryDto) {
    const items = await this.prisma.order.findMany({
      where: { buyerUserId: userId, status: q.status },
      include,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (q.page - 1) * q.limit,
      take: q.limit,
    });
    return { page: q.page, limit: q.limit, items: items.map(mapOrder) };
  }
  async get(userId: string, code: string) {
    const order = await this.prisma.order.findFirst({
      where: { buyerUserId: userId, publicCode: code },
      include,
    });
    if (!order) this.fail('ORDER_NOT_FOUND', 404);
    return mapOrder(order);
  }
  async cancel(userId: string, code: string, key: string, dto: CancelOrderDto) {
    const keyHash = sha256(key),
      requestHash = canonicalRequestHash({ code, ...dto });
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'idempotency:' + userId + ':ORDER_CANCEL:' + keyHash}))`;
      const prior = await tx.commerceIdempotencyRecord.findUnique({
        where: {
          actorUserId_operation_keyHash: {
            actorUserId: userId,
            operation: CommerceIdempotencyOperation.ORDER_CANCEL,
            keyHash,
          },
        },
      });
      if (prior) {
        if (prior.requestHash !== requestHash) this.fail('IDEMPOTENCY_KEY_REUSED', 409);
        if (prior.responseBody) return prior.responseBody;
      }
      const found = await tx.order.findFirst({
        where: { buyerUserId: userId, publicCode: code },
        select: { id: true },
      });
      if (!found) this.fail('ORDER_NOT_FOUND', 404);
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'order:' + found.id}))`;
      const order = await tx.order.findFirst({
        where: { id: found.id, buyerUserId: userId },
        include,
      });
      if (!order) this.fail('ORDER_NOT_FOUND', 404);
      if (order.status === OrderStatus.CANCELLED) return mapOrder(order);
      if (order.version !== dto.expectedVersion) this.fail('ORDER_VERSION_CONFLICT', 409);
      if (
        order.status !== OrderStatus.PENDING_PAYMENT ||
        order.paymentStatus !== PaymentStatus.NOT_CREATED
      )
        this.fail('ORDER_NOT_CANCELLABLE', 409);
      const now = new Date();
      await tx.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.CANCELLED, cancelledAt: now, version: { increment: 1 } },
      });
      const released = await tx.inventoryReservation.updateMany({
        where: { orderId: order.id, status: InventoryReservationStatus.ACTIVE },
        data: {
          status: InventoryReservationStatus.RELEASED,
          releasedAt: now,
          releaseReason: 'BUYER_CANCELLED',
        },
      });
      await this.event(tx, order.id, OrderEventType.ORDER_CANCELLED, userId);
      if (released.count) await this.event(tx, order.id, OrderEventType.INVENTORY_RELEASED, userId);
      await tx.securityEvent.create({
        data: {
          userId,
          eventType: SecurityEventType.ORDER_CANCELLED,
          outcome: SecurityEventOutcome.SUCCESS,
          metadata: { orderId: order.id },
        },
      });
      const updated = await tx.order.findUniqueOrThrow({ where: { id: order.id }, include });
      const response = mapOrder(updated);
      await tx.commerceIdempotencyRecord.create({
        data: {
          actorUserId: userId,
          operation: CommerceIdempotencyOperation.ORDER_CANCEL,
          keyHash,
          requestHash,
          responseStatus: 200,
          responseBody: response as Prisma.InputJsonObject,
          resourceType: 'ORDER',
          resourceId: order.id,
          completedAt: now,
          expiresAt: new Date(now.getTime() + 86400000),
        },
      });
      return response;
    });
  }
  private async event(
    tx: Prisma.TransactionClient,
    orderId: string,
    type: OrderEventType,
    actorUserId: string | null,
  ) {
    const event = await tx.orderEvent.create({
      data: { orderId, type, actorUserId, metadata: { orderId } },
    });
    await tx.outboxEvent.create({
      data: {
        orderEventId: event.id,
        aggregateType: 'ORDER',
        aggregateId: orderId,
        eventType: type,
        payload: { orderId, eventId: event.id, type },
        status: OutboxEventStatus.PENDING,
      },
    });
  }
  private fail(code: string, status: number): never {
    throw new AppError(code, code, status);
  }
}
