import { Injectable } from '@nestjs/common';
import {
  InventoryReservationStatus,
  OrderEventType,
  OrderStatus,
  OutboxEventStatus,
  SecurityEventOutcome,
  SecurityEventType,
} from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { acquireAdvisoryTransactionLock } from '../database/advisory-lock';
@Injectable()
export class OrderExpirationService {
  constructor(private readonly prisma: PrismaService) {}
  async expire(batch = 100) {
    const ids = await this.prisma.order.findMany({
      where: { status: OrderStatus.PENDING_PAYMENT, expiresAt: { lte: new Date() } },
      select: { id: true },
      orderBy: { expiresAt: 'asc' },
      take: batch,
    });
    let expired = 0;
    for (const { id } of ids)
      expired += await this.prisma.$transaction(async (tx) => {
        await acquireAdvisoryTransactionLock(tx, 'order:' + id);
        const order = await tx.order.findFirst({
          where: { id, status: OrderStatus.PENDING_PAYMENT, expiresAt: { lte: new Date() } },
        });
        if (!order) return 0;
        const now = new Date();
        await tx.order.update({
          where: { id },
          data: { status: OrderStatus.EXPIRED, expiredAt: now, version: { increment: 1 } },
        });
        const released = await tx.inventoryReservation.updateMany({
          where: { orderId: id, status: InventoryReservationStatus.ACTIVE },
          data: {
            status: InventoryReservationStatus.EXPIRED,
            releasedAt: now,
            releaseReason: 'ORDER_EXPIRED',
          },
        });
        const event = await tx.orderEvent.create({
          data: { orderId: id, type: OrderEventType.ORDER_EXPIRED, metadata: { orderId: id } },
        });
        await tx.outboxEvent.create({
          data: {
            orderEventId: event.id,
            aggregateType: 'ORDER',
            aggregateId: id,
            eventType: OrderEventType.ORDER_EXPIRED,
            payload: { orderId: id, eventId: event.id, type: OrderEventType.ORDER_EXPIRED },
            status: OutboxEventStatus.PENDING,
          },
        });
        if (released.count > 0) {
          const releaseEvent = await tx.orderEvent.create({
            data: {
              orderId: id,
              type: OrderEventType.INVENTORY_RELEASED,
              metadata: { orderId: id, reason: 'ORDER_EXPIRED' },
            },
          });
          await tx.outboxEvent.create({
            data: {
              orderEventId: releaseEvent.id,
              aggregateType: 'ORDER',
              aggregateId: id,
              eventType: OrderEventType.INVENTORY_RELEASED,
              payload: {
                orderId: id,
                eventId: releaseEvent.id,
                type: OrderEventType.INVENTORY_RELEASED,
              },
              status: OutboxEventStatus.PENDING,
            },
          });
        }
        await tx.securityEvent.create({
          data: {
            userId: order.buyerUserId,
            eventType: SecurityEventType.ORDER_EXPIRED,
            outcome: SecurityEventOutcome.SUCCESS,
            metadata: { orderId: id },
          },
        });
        return 1;
      });
    return { examined: ids.length, expired };
  }
}
