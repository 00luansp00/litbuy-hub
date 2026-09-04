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
import { acquireAdvisoryTransactionLock } from '../database/advisory-lock';
import { AppError } from '../common/errors/app-error';
import { canonicalRequestHash } from '../commerce/idempotency-key';
import { mapOrder, orderReadInclude } from './order-read.mapper';
import type { ParsedIdempotencyKey } from '../commerce/idempotency-key';
import type { CancelOrderDto, OrderListQueryDto } from './orders.dto';
import { DisputeCoreService } from '../disputes/dispute-core.service';
@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly disputes: DisputeCoreService,
  ) {}
  async list(userId: string, q: OrderListQueryDto) {
    const items = await this.prisma.order.findMany({
      where: { buyerUserId: userId, status: q.status },
      include: orderReadInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (q.page - 1) * q.limit,
      take: q.limit,
    });
    return { page: q.page, limit: q.limit, items: items.map(mapOrder) };
  }
  async get(userId: string, code: string) {
    const order = await this.prisma.order.findFirst({
      where: { buyerUserId: userId, publicCode: code },
      include: orderReadInclude,
    });
    if (!order) this.fail('ORDER_NOT_FOUND', 404);
    return mapOrder(order);
  }
  async reportProblem(userId: string, code: string, key: ParsedIdempotencyKey) {
    const keyHash = key.hash;
    const requestHash = canonicalRequestHash({ orderCode: code });
    return this.prisma.$transaction(async (tx) => {
      await acquireAdvisoryTransactionLock(
        tx,
        `idempotency:${userId}:BUYER_REPORT_PROBLEM:${keyHash}`,
      );
      const prior = await tx.commerceIdempotencyRecord.findUnique({
        where: {
          actorUserId_operation_keyHash: {
            actorUserId: userId,
            operation: CommerceIdempotencyOperation.BUYER_REPORT_PROBLEM,
            keyHash,
          },
        },
      });
      if (prior) {
        if (prior.requestHash !== requestHash) this.fail('IDEMPOTENCY_KEY_REUSED', 409);
        if (prior.responseBody) return prior.responseBody;
      }
      const order = await tx.order.findFirst({
        where: { buyerUserId: userId, publicCode: code },
        include: orderReadInclude,
      });
      if (!order) this.fail('ORDER_NOT_FOUND', 404);
      // Shared serialization boundary with both Seller release gates. The dispute
      // is materialized only after owning the authoritative Order row lock.
      await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${order.id}::uuid FOR UPDATE`;
      // Materialize a new row version without changing domain data. PostgreSQL then
      // makes a financial SERIALIZABLE transaction that took an older snapshot retry,
      // rather than letting it miss the newly committed child DisputeCase.
      await tx.$executeRaw`UPDATE "Order" SET "id" = "id" WHERE "id" = ${order.id}::uuid`;
      await this.disputes.createCase({ orderId: order.id, actorUserId: userId }, tx);
      const updated = await tx.order.findUniqueOrThrow({
        where: { id: order.id },
        include: orderReadInclude,
      });
      const response = mapOrder(updated);
      await this.completeIdempotency(
        tx,
        CommerceIdempotencyOperation.BUYER_REPORT_PROBLEM,
        userId,
        keyHash,
        requestHash,
        order.id,
        response,
        undefined,
        new Date('9999-12-31T23:59:59.999Z'),
      );
      return response;
    });
  }
  async cancel(userId: string, code: string, key: ParsedIdempotencyKey, dto: CancelOrderDto) {
    const keyHash = key.hash,
      requestHash = canonicalRequestHash({ code, ...dto });
    return this.prisma.$transaction(async (tx) => {
      await acquireAdvisoryTransactionLock(
        tx,
        'idempotency:' + userId + ':ORDER_CANCEL:' + keyHash,
      );
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
      await acquireAdvisoryTransactionLock(tx, 'order:' + found.id);
      const order = await tx.order.findFirst({
        where: { id: found.id, buyerUserId: userId },
        include: orderReadInclude,
      });
      if (!order) this.fail('ORDER_NOT_FOUND', 404);
      if (order.status === OrderStatus.CANCELLED) {
        const response = mapOrder(order);
        await this.completeIdempotency(
          tx,
          CommerceIdempotencyOperation.ORDER_CANCEL,
          userId,
          keyHash,
          requestHash,
          order.id,
          response,
        );
        return response;
      }
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
      const updated = await tx.order.findUniqueOrThrow({
        where: { id: order.id },
        include: orderReadInclude,
      });
      const response = mapOrder(updated);
      await this.completeIdempotency(
        tx,
        CommerceIdempotencyOperation.ORDER_CANCEL,
        userId,
        keyHash,
        requestHash,
        order.id,
        response,
        now,
      );
      return response;
    });
  }
  private async completeIdempotency(
    tx: Prisma.TransactionClient,
    operation: CommerceIdempotencyOperation,
    actorUserId: string,
    keyHash: string,
    requestHash: string,
    resourceId: string,
    responseBody: Prisma.InputJsonObject,
    now = new Date(),
    expiresAt?: Date,
  ) {
    await tx.commerceIdempotencyRecord.create({
      data: {
        actorUserId,
        operation,
        keyHash,
        requestHash,
        responseStatus: 200,
        responseBody,
        resourceType: 'ORDER',
        resourceId,
        completedAt: now,
        expiresAt: expiresAt ?? new Date(now.getTime() + 86_400_000),
      },
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
