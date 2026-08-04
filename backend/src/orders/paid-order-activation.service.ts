import { Injectable } from '@nestjs/common';
import {
  InventoryReservationStatus,
  OrderEventType,
  OrderStatus,
  OutboxEventStatus,
  PaymentStatus,
  Prisma,
  ReconciliationIssueType,
} from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { acquireAdvisoryTransactionLock } from '../database/advisory-lock';

const REFERENCE_TYPE = 'OrderActivation';
type Tx = Prisma.TransactionClient;
type Failure = { type: ReconciliationIssueType; code: string };
class ActivationRollback extends Error {
  constructor(readonly failure: Failure) {
    super(failure.code);
  }
}

@Injectable()
export class PaidOrderActivationService {
  constructor(private readonly prisma: PrismaService) {}

  async processOne(orderId?: string): Promise<boolean> {
    const id = orderId ?? (await this.nextCandidate());
    if (!id) return false;
    try {
      await this.prisma.$transaction((tx) => this.activate(tx, id));
    } catch (error) {
      if (!(error instanceof ActivationRollback)) throw error;
      await this.prisma.$transaction(async (tx) => {
        await acquireAdvisoryTransactionLock(tx, `order:${id}`);
        await this.ensureIssue(id, error.failure, tx);
      });
    }
    // A candidate was claimed even when another worker completed it while this worker waited.
    // processBatch must only stop when candidate selection itself returns no row.
    return true;
  }

  async processBatch(limit = 25): Promise<number> {
    let processed = 0;
    const bounded = Math.max(1, Math.min(limit, 100));
    while (processed < bounded && (await this.processOne())) processed += 1;
    return processed;
  }

  private async nextCandidate(): Promise<string | null> {
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT o."id"
      FROM "Order" o
      JOIN "Payment" p ON p."orderId" = o."id"
      WHERE o."status" = 'PENDING_PAYMENT'
        AND p."status" = 'PAID'
        AND p."paidAt" IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM "ReconciliationIssue" r
          WHERE r."referenceType" = ${REFERENCE_TYPE}
            AND r."referenceId" = o."id"::text
            AND r."status" IN ('OPEN', 'INVESTIGATING')
        )
      ORDER BY p."paidAt", o."id"
      LIMIT 1
    `;
    return rows[0]?.id ?? null;
  }

  private async activate(tx: Tx, orderId: string): Promise<boolean> {
    await acquireAdvisoryTransactionLock(tx, `order:${orderId}`);
    const attempts = await tx.$queryRaw<LockedAttempt[]>`
      SELECT a."id", a."paymentId", a."providerCode", a."externalPaymentId",
             a."amountMinor", a."currency"
      FROM "PaymentAttempt" a
      JOIN "Payment" p ON p."id" = a."paymentId"
      WHERE p."orderId" = ${orderId}::uuid AND a."status" = 'SUCCEEDED'
      ORDER BY a."id" FOR UPDATE OF a
    `;
    const payments = await tx.$queryRaw<LockedPayment[]>`
      SELECT "id", "orderId", "status", "paidAt", "amountMinor", "currency"
      FROM "Payment" WHERE "orderId" = ${orderId}::uuid FOR UPDATE
    `;
    const orders = await tx.$queryRaw<LockedOrder[]>`
      SELECT "id", "status", "paymentStatus", "totalAmountMinor", "currency", "expiresAt"
      FROM "Order" WHERE "id" = ${orderId}::uuid FOR UPDATE
    `;
    const order = orders[0];
    if (!order) return false;
    if (order.status === OrderStatus.ACTIVE) return false;
    if (order.status !== OrderStatus.PENDING_PAYMENT)
      return this.reject(tx, orderId, 'STATUS_MISMATCH', 'ORDER_STATUS_MISMATCH');
    const payment = payments[0];
    if (!payment) return this.reject(tx, orderId, 'MISSING_LOCAL', 'PAYMENT_MISSING');
    if (payment.status !== PaymentStatus.PAID)
      return this.reject(tx, orderId, 'STATUS_MISMATCH', 'PAYMENT_NOT_PAID');
    if (!payment.paidAt)
      return this.reject(tx, orderId, 'STATUS_MISMATCH', 'PAYMENT_PAID_AT_MISSING');
    if (payment.currency !== 'BRL' || order.currency !== 'BRL')
      return this.reject(tx, orderId, 'OTHER', 'PAYMENT_CURRENCY_MISMATCH');
    if (payment.amountMinor !== order.totalAmountMinor)
      return this.reject(tx, orderId, 'AMOUNT_MISMATCH', 'PAYMENT_AMOUNT_MISMATCH');
    if (attempts.length !== 1)
      return this.reject(
        tx,
        orderId,
        'STATUS_MISMATCH',
        attempts.length ? 'MULTIPLE_SUCCEEDED_ATTEMPTS' : 'SUCCEEDED_ATTEMPT_MISSING',
      );
    const attempt = attempts[0];
    if (
      !attempt.providerCode.trim() ||
      !attempt.externalPaymentId ||
      attempt.paymentId !== payment.id ||
      attempt.currency !== 'BRL' ||
      attempt.amountMinor !== payment.amountMinor
    )
      return this.reject(tx, orderId, 'STATUS_MISMATCH', 'SUCCEEDED_ATTEMPT_MISMATCH');
    if (order.paymentStatus !== PaymentStatus.PENDING && order.paymentStatus !== PaymentStatus.PAID)
      return this.reject(tx, orderId, 'STATUS_MISMATCH', 'ORDER_PAYMENT_STATUS_MISMATCH');
    if (payment.paidAt > order.expiresAt)
      return this.reject(tx, orderId, 'LATE_PAYMENT', 'LATE_PAYMENT');

    const items = await tx.$queryRaw<LockedItem[]>`
      SELECT i."id", i."sourceProductId", i."sourceProductVariantId", i."productModel", i."quantity"
      FROM "OrderItem" i WHERE i."orderId" = ${orderId}::uuid ORDER BY i."id" FOR UPDATE
    `;
    const reservations = await tx.$queryRaw<LockedReservation[]>`
      SELECT "id", "orderItemId", "productId", "productVariantId", "quantity", "status", "expiresAt",
             "releasedAt", "consumedAt", "releaseReason"
      FROM "InventoryReservation" WHERE "orderId" = ${orderId}::uuid ORDER BY "id" FOR UPDATE
    `;
    const required = items.filter((item) => item.productModel !== 'SERVICE');
    if (reservations.length !== required.length)
      return this.reject(tx, orderId, 'MISSING_LOCAL', 'RESERVATION_MISSING');
    const consumptions: Array<{ reservation: LockedReservation; key: string; model: string }> = [];
    for (const item of required) {
      const matches = reservations.filter((reservation) => reservation.orderItemId === item.id);
      if (matches.length !== 1)
        return this.reject(tx, orderId, 'MISSING_LOCAL', 'RESERVATION_MISSING');
      const reservation = matches[0];
      const dynamic = item.productModel === 'DYNAMIC';
      if (
        reservation.productId !== item.sourceProductId ||
        reservation.quantity !== item.quantity ||
        (dynamic
          ? !item.sourceProductVariantId ||
            reservation.productVariantId !== item.sourceProductVariantId
          : reservation.productVariantId !== null)
      )
        return this.reject(tx, orderId, 'OTHER', 'RESERVATION_MISMATCH');
      if (reservation.status !== InventoryReservationStatus.ACTIVE)
        return this.reject(
          tx,
          orderId,
          reservation.status === 'RELEASED' || reservation.status === 'EXPIRED'
            ? 'LATE_PAYMENT'
            : 'STATUS_MISMATCH',
          'RESERVATION_NOT_ACTIVE',
        );
      if (reservation.releasedAt || reservation.consumedAt || reservation.releaseReason)
        return this.reject(tx, orderId, 'STATUS_MISMATCH', 'RESERVATION_METADATA_MISMATCH');
      if (payment.paidAt > reservation.expiresAt)
        return this.reject(tx, orderId, 'LATE_PAYMENT', 'LATE_PAYMENT');
      consumptions.push({
        reservation,
        model: item.productModel,
        key: dynamic
          ? `checkout-stock:variant:${item.sourceProductVariantId}`
          : `checkout-stock:product:${item.sourceProductId}`,
      });
    }
    for (const key of [...new Set(consumptions.map(({ key }) => key))].sort())
      await acquireAdvisoryTransactionLock(tx, key);
    for (const { reservation, model } of consumptions) {
      const changed =
        model === 'DYNAMIC'
          ? await tx.productVariant.updateMany({
              where: {
                id: reservation.productVariantId!,
                productId: reservation.productId,
                stock: { not: null, gte: reservation.quantity },
              },
              data: { stock: { decrement: reservation.quantity } },
            })
          : await tx.product.updateMany({
              where: {
                id: reservation.productId,
                stock: { not: null, gte: reservation.quantity },
              },
              data: { stock: { decrement: reservation.quantity } },
            });
      if (changed.count !== 1)
        throw new ActivationRollback({ type: 'OTHER', code: 'RESERVED_STOCK_UNAVAILABLE' });
    }
    const activatedAt = new Date();
    if (consumptions.length)
      await tx.inventoryReservation.updateMany({
        where: {
          id: { in: consumptions.map(({ reservation }) => reservation.id) },
          status: 'ACTIVE',
        },
        data: { status: 'CONSUMED', consumedAt: activatedAt },
      });
    await tx.order.update({
      where: { id: orderId },
      data: { status: 'ACTIVE', paymentStatus: 'PAID', version: { increment: 1 } },
    });
    await this.event(tx, orderId, 'ORDER_ACTIVATED', {
      orderId,
      paymentId: payment.id,
      paidAt: payment.paidAt.toISOString(),
    });
    if (consumptions.length)
      await this.event(tx, orderId, 'INVENTORY_CONSUMED', {
        orderId,
        reservationIds: consumptions.map(({ reservation }) => reservation.id),
      });
    return true;
  }

  private async reject(tx: Tx, orderId: string, type: ReconciliationIssueType, code: string) {
    await this.ensureIssue(orderId, { type, code }, tx);
    return true;
  }

  private async ensureIssue(
    orderId: string,
    failure: Failure,
    client: Tx | PrismaService = this.prisma,
  ) {
    const existing = await client.reconciliationIssue.findFirst({
      where: {
        referenceType: REFERENCE_TYPE,
        referenceId: orderId,
        status: { in: ['OPEN', 'INVESTIGATING'] },
      },
    });
    if (!existing)
      await client.reconciliationIssue.create({
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
    metadata: Prisma.InputJsonObject,
  ) {
    const event = await tx.orderEvent.create({ data: { orderId, type, metadata } });
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
}

type LockedAttempt = {
  id: string;
  paymentId: string;
  providerCode: string;
  externalPaymentId: string | null;
  amountMinor: bigint;
  currency: string;
};
type LockedPayment = {
  id: string;
  orderId: string;
  status: PaymentStatus;
  paidAt: Date | null;
  amountMinor: bigint;
  currency: string;
};
type LockedOrder = {
  id: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  totalAmountMinor: bigint;
  currency: string;
  expiresAt: Date;
};
type LockedItem = {
  id: string;
  sourceProductId: string;
  sourceProductVariantId: string | null;
  productModel: string;
  quantity: number;
};
type LockedReservation = {
  id: string;
  orderItemId: string;
  productId: string;
  productVariantId: string | null;
  quantity: number;
  status: InventoryReservationStatus;
  expiresAt: Date;
  releasedAt: Date | null;
  consumedAt: Date | null;
  releaseReason: string | null;
};
