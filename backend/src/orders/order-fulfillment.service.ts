import { createHash } from 'node:crypto';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  DisputeStatus,
  FulfillmentStatus,
  OrderDeliveryType,
  OrderEventType,
  OrderStatus,
  OutboxEventStatus,
  PaymentStatus,
  Prisma,
  ReconciliationIssueType,
} from '@prisma/client';
import { acquireAdvisoryTransactionLock } from '../database/advisory-lock';
import { PrismaService } from '../database/prisma.service';

const REFERENCE_TYPE = 'OrderFulfillment';
const SALE_REFERENCE_TYPE = 'OrderSale';
const SALE_TYPE = 'SALE_RECOGNIZED';
type Tx = Prisma.TransactionClient;
type Failure = { type: ReconciliationIssueType; code: string };

type LockedOrder = {
  id: string;
  publicCode: string;
  buyerUserId: string;
  sellerProfileId: string;
  sellerUserId: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  disputeStatus: DisputeStatus;
  version: number;
};

export type RecordDeliveryInput = {
  orderCode: string;
  actorUserId: string;
  deliveryType: OrderDeliveryType;
  evidenceHash: string;
};

@Injectable()
export class OrderFulfillmentService {
  constructor(private readonly prisma: PrismaService) {}

  async processAvailabilityBatch(limit = 25): Promise<number> {
    const bounded = Math.max(1, Math.min(limit, 100));
    let processed = 0;
    while (processed < bounded) {
      const candidate = await this.prisma.order.findFirst({
        where: {
          status: 'ACTIVE',
          paymentStatus: 'PAID',
          fulfillmentStatus: 'NOT_AVAILABLE',
          disputeStatus: { notIn: ['OPEN', 'UNDER_REVIEW'] },
          NOT: {
            id: {
              in: (
                await this.prisma.reconciliationIssue.findMany({
                  where: {
                    referenceType: REFERENCE_TYPE,
                    status: { in: ['OPEN', 'INVESTIGATING'] },
                    referenceId: { not: null },
                  },
                  select: { referenceId: true },
                })
              ).flatMap(({ referenceId }) => (referenceId ? [referenceId] : [])),
            },
          },
        },
        select: { id: true },
        orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      });
      if (!candidate) break;
      if (await this.makeAvailable(candidate.id)) processed += 1;
    }
    return processed;
  }

  async makeAvailable(orderId: string): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      await acquireAdvisoryTransactionLock(tx, `order:${orderId}`);
      const order = await this.lockOrder(tx, orderId);
      if (!order) return false;
      if (order.fulfillmentStatus === FulfillmentStatus.AWAITING_SELLER) return false;
      const failure = await this.baseFailure(tx, order, FulfillmentStatus.NOT_AVAILABLE);
      if (failure) return this.reject(tx, order.id, failure);
      await tx.order.update({
        where: { id: order.id },
        data: { fulfillmentStatus: 'AWAITING_SELLER', version: { increment: 1 } },
      });
      await this.event(tx, order.id, 'FULFILLMENT_AVAILABLE', 'fulfillment.available', undefined, {
        orderId: order.id,
        actorRole: 'SYSTEM',
      });
      return true;
    });
  }

  async recordDelivered(input: RecordDeliveryInput) {
    const evidenceHash = input.evidenceHash.trim().toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(evidenceHash))
      throw new ConflictException('A delivery evidence hash is required');
    return this.prisma.$transaction(async (tx) => {
      const visible = await this.findSellerOrder(tx, input.orderCode, input.actorUserId);
      if (!visible) throw new NotFoundException('Order not found');
      await acquireAdvisoryTransactionLock(tx, `order:${visible.id}`);
      const order = await this.lockOrder(tx, visible.id);
      if (!order || order.sellerUserId !== input.actorUserId)
        throw new NotFoundException('Order not found');
      const existing = await tx.orderDelivery.findUnique({ where: { orderId: order.id } });
      if (
        existing &&
        ['DELIVERED', 'AWAITING_BUYER_CONFIRMATION', 'CONFIRMED'].includes(order.fulfillmentStatus)
      )
        return {
          orderId: order.id,
          deliveryId: existing.id,
          fulfillmentStatus: order.fulfillmentStatus,
        };
      const failure = await this.baseFailure(tx, order, FulfillmentStatus.AWAITING_SELLER);
      if (failure) throw new ConflictException(failure.code);
      if (existing) throw new ConflictException('FULFILLMENT_STATE_MISMATCH');
      const delivery = await tx.orderDelivery.create({
        data: {
          orderId: order.id,
          sellerProfileId: order.sellerProfileId,
          deliveryType: input.deliveryType,
          evidenceHash,
        },
      });
      await tx.order.update({
        where: { id: order.id },
        data: { fulfillmentStatus: 'DELIVERED', version: { increment: 1 } },
      });
      const metadata = {
        orderId: order.id,
        deliveryId: delivery.id,
        deliveryType: delivery.deliveryType,
        evidenceHash: delivery.evidenceHash,
        actorRole: 'SELLER',
      };
      await this.event(
        tx,
        order.id,
        'FULFILLMENT_DELIVERED',
        'fulfillment.delivered',
        input.actorUserId,
        metadata,
      );
      await tx.order.update({
        where: { id: order.id },
        data: { fulfillmentStatus: 'AWAITING_BUYER_CONFIRMATION', version: { increment: 1 } },
      });
      await this.event(
        tx,
        order.id,
        'FULFILLMENT_AWAITING_BUYER_CONFIRMATION',
        'fulfillment.awaiting_buyer_confirmation',
        undefined,
        { ...metadata, actorRole: 'SYSTEM' },
      );
      return {
        orderId: order.id,
        deliveryId: delivery.id,
        fulfillmentStatus: FulfillmentStatus.AWAITING_BUYER_CONFIRMATION,
      };
    });
  }

  async confirmReceipt(orderCode: string, actorUserId: string) {
    return this.prisma.$transaction(async (tx) => {
      const visible = await tx.order.findFirst({
        where: { publicCode: orderCode, buyerUserId: actorUserId },
        select: { id: true },
      });
      if (!visible) throw new NotFoundException('Order not found');
      await acquireAdvisoryTransactionLock(tx, `order:${visible.id}`);
      const order = await this.lockOrder(tx, visible.id);
      if (!order || order.buyerUserId !== actorUserId)
        throw new NotFoundException('Order not found');
      if (order.fulfillmentStatus === FulfillmentStatus.CONFIRMED) {
        return {
          orderId: order.id,
          status: order.status,
          fulfillmentStatus: order.fulfillmentStatus,
        };
      }
      const failure = await this.baseFailure(
        tx,
        order,
        FulfillmentStatus.AWAITING_BUYER_CONFIRMATION,
      );
      if (failure) throw new ConflictException(failure.code);
      const delivery = await tx.orderDelivery.findUnique({ where: { orderId: order.id } });
      if (!delivery) {
        await this.ensureIssue(tx, order.id, {
          type: 'MISSING_LOCAL',
          code: 'DELIVERY_RECORD_MISSING',
        });
        throw new ConflictException('DELIVERY_RECORD_MISSING');
      }
      if (delivery.sellerProfileId !== order.sellerProfileId) {
        await this.ensureIssue(tx, order.id, {
          type: 'STATUS_MISMATCH',
          code: 'DELIVERY_SELLER_MISMATCH',
        });
        throw new ConflictException('DELIVERY_SELLER_MISMATCH');
      }
      await tx.order.update({
        where: { id: order.id },
        data: { fulfillmentStatus: 'CONFIRMED', version: { increment: 1 } },
      });
      await this.event(
        tx,
        order.id,
        'FULFILLMENT_CONFIRMED',
        'fulfillment.confirmed',
        actorUserId,
        { orderId: order.id, deliveryId: delivery.id, actorRole: 'BUYER' },
      );
      await this.completeLocked(tx, { ...order, fulfillmentStatus: FulfillmentStatus.CONFIRMED });
      const current = await tx.order.findUniqueOrThrow({ where: { id: order.id } });
      return {
        orderId: current.id,
        status: current.status,
        fulfillmentStatus: current.fulfillmentStatus,
      };
    });
  }

  async processCompletion(orderId: string): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      await acquireAdvisoryTransactionLock(tx, `order:${orderId}`);
      const order = await this.lockOrder(tx, orderId);
      if (!order || order.status === OrderStatus.COMPLETED) return false;
      return this.completeLocked(tx, order);
    });
  }

  private async completeLocked(tx: Tx, order: LockedOrder): Promise<boolean> {
    const failure = await this.baseFailure(tx, order, FulfillmentStatus.CONFIRMED);
    if (failure) return this.reject(tx, order.id, failure);
    const recognitions = await tx.ledgerTransaction.findMany({
      where: { type: SALE_TYPE, referenceType: SALE_REFERENCE_TYPE, referenceId: order.id },
    });
    const expectedKey = createHash('sha256')
      .update(`sale-recognition:v1:${order.id}`)
      .digest('hex');
    if (!recognitions.length)
      return this.reject(tx, order.id, {
        type: 'MISSING_LOCAL',
        code: 'SALE_RECOGNITION_MISSING',
      });
    if (recognitions.length !== 1 || recognitions[0].idempotencyKeyHash !== expectedKey)
      return this.reject(tx, order.id, { type: 'OTHER', code: 'SALE_RECOGNITION_INVALID' });
    await tx.order.update({
      where: { id: order.id },
      data: { status: 'COMPLETED', version: { increment: 1 } },
    });
    await this.event(tx, order.id, 'ORDER_COMPLETED', 'order.completed', undefined, {
      orderId: order.id,
      actorRole: 'SYSTEM',
    });
    return true;
  }

  private async baseFailure(
    tx: Tx,
    order: LockedOrder,
    expectedFulfillment: FulfillmentStatus,
  ): Promise<Failure | null> {
    if (order.status !== OrderStatus.ACTIVE)
      return { type: 'STATUS_MISMATCH', code: 'ORDER_STATE_MISMATCH' };
    if (order.paymentStatus !== PaymentStatus.PAID)
      return { type: 'STATUS_MISMATCH', code: 'PAYMENT_NOT_PAID' };
    if (order.fulfillmentStatus !== expectedFulfillment)
      return { type: 'STATUS_MISMATCH', code: 'FULFILLMENT_STATE_MISMATCH' };
    if (
      order.disputeStatus === DisputeStatus.OPEN ||
      order.disputeStatus === DisputeStatus.UNDER_REVIEW
    )
      return { type: 'STATUS_MISMATCH', code: 'ACTIVE_DISPUTE' };
    const payments = await tx.payment.findMany({ where: { orderId: order.id } });
    if (payments.length !== 1) return { type: 'MISSING_LOCAL', code: 'PAYMENT_MISSING' };
    if (payments[0].status !== PaymentStatus.PAID)
      return { type: 'STATUS_MISMATCH', code: 'PAYMENT_NOT_PAID' };
    return null;
  }

  private async lockOrder(tx: Tx, orderId: string): Promise<LockedOrder | null> {
    const rows = await tx.$queryRaw<LockedOrder[]>`
      SELECT o."id", o."publicCode", o."buyerUserId", o."sellerProfileId",
             sp."userId" AS "sellerUserId", o."status", o."paymentStatus",
             o."fulfillmentStatus", o."disputeStatus", o."version"
      FROM "Order" o JOIN "SellerProfile" sp ON sp."id" = o."sellerProfileId"
      WHERE o."id" = ${orderId}::uuid FOR UPDATE OF o
    `;
    return rows[0] ?? null;
  }

  private findSellerOrder(tx: Tx, publicCode: string, actorUserId: string) {
    return tx.order.findFirst({
      where: { publicCode, sellerProfile: { userId: actorUserId } },
      select: { id: true },
    });
  }

  private async reject(tx: Tx, orderId: string, failure: Failure): Promise<false> {
    await this.ensureIssue(tx, orderId, failure);
    return false;
  }

  private async ensureIssue(tx: Tx, orderId: string, failure: Failure) {
    await acquireAdvisoryTransactionLock(tx, `order-fulfillment-issue:${orderId}`);
    const existing = await tx.reconciliationIssue.findFirst({
      where: {
        referenceType: REFERENCE_TYPE,
        referenceId: orderId,
        status: { in: ['OPEN', 'INVESTIGATING'] },
      },
    });
    if (!existing)
      await tx.reconciliationIssue.create({
        data: {
          type: failure.type,
          referenceType: REFERENCE_TYPE,
          referenceId: orderId,
          details: { errorCode: failure.code },
        },
      });
  }

  private async event(
    tx: Tx,
    orderId: string,
    type: OrderEventType,
    eventType: string,
    actorUserId: string | undefined,
    metadata: Prisma.InputJsonObject,
  ) {
    const event = await tx.orderEvent.create({ data: { orderId, type, actorUserId, metadata } });
    await tx.outboxEvent.create({
      data: {
        orderEventId: event.id,
        aggregateType: 'ORDER',
        aggregateId: orderId,
        eventType,
        payload: { orderId, eventId: event.id, type },
        status: OutboxEventStatus.PENDING,
      },
    });
  }
}
