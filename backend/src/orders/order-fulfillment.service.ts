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
  SellerMaxQualificationStatus,
} from '@prisma/client';
import { acquireAdvisoryTransactionLock } from '../database/advisory-lock';
import { PrismaService } from '../database/prisma.service';
import { calculateSellerMaxRelease } from '../financial/seller-max-release-calculator';

const REFERENCE_TYPE = 'OrderFulfillment';
const SALE_REFERENCE_TYPE = 'OrderSale';
const SALE_TYPE = 'SALE_RECOGNIZED';
export const classifySellerMaxQualification = (
  deadlineAt: Date,
  buyerConfirmedAt: Date,
): SellerMaxQualificationStatus =>
  buyerConfirmedAt.getTime() <= deadlineAt.getTime()
    ? SellerMaxQualificationStatus.QUALIFIED
    : SellerMaxQualificationStatus.EXPIRED;
export const isSellerMaxQualificationExpired = (deadlineAt: Date, dbClock: Date): boolean =>
  dbClock.getTime() > deadlineAt.getTime();
type Tx = Prisma.TransactionClient;
type Failure = { type: ReconciliationIssueType; code: string };
type CandidateResult = 'NO_CANDIDATE' | 'ALREADY_HANDLED' | 'PROCESSED';
type MutationResult<T> =
  | { kind: 'SUCCESS'; value: T }
  | { kind: 'REPLAY'; value: T }
  | { kind: 'BUSINESS_BLOCK'; code: string }
  | { kind: 'SYSTEM_INCONSISTENCY'; code: string };

type FulfillmentResponse = {
  orderId: string;
  deliveryId?: string;
  status?: OrderStatus;
  fulfillmentStatus: FulfillmentStatus;
};
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
  sellerPlanSnapshot: string | null;
  sellerMaxQualificationVersion: number | null;
  sellerMaxQualificationStatus: SellerMaxQualificationStatus | null;
  sellerMaxQualificationDeadlineAt: Date | null;
  sellerMaxQualificationDecidedAt: Date | null;
  buyerConfirmedAt: Date | null;
  frozenBaseReleaseDelayHours: number | null;
  sellerMaxReleaseCalculationVersion: number | null;
  sellerMaxReleaseReductionHours: number | null;
  sellerMaxReleaseTargetAt: Date | null;
  sellerMaxEffectiveReleaseAt: Date | null;
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

  recordSellerDeclaredDelivery(orderCode: string, actorUserId: string) {
    const evidenceHash = createHash('sha256')
      .update(`seller-declaration:v1:${orderCode}:${actorUserId}`)
      .digest('hex');
    return this.recordDelivered({
      orderCode,
      actorUserId,
      deliveryType: OrderDeliveryType.MANUAL_REFERENCE,
      evidenceHash,
    });
  }

  async processAvailabilityBatch(limit = 25): Promise<number> {
    return this.processBatch(
      limit,
      () => this.nextAvailabilityCandidate(),
      (id) => this.makeAvailableResult(id),
    );
  }

  async processCompletionBatch(limit = 25): Promise<number> {
    return this.processBatch(
      limit,
      () => this.nextCompletionCandidate(),
      (id) => this.processCompletionResult(id),
    );
  }

  async processSellerMaxQualificationExpirationBatch(limit = 25): Promise<number> {
    return this.processBatch(
      limit,
      () => this.nextSellerMaxExpirationCandidate(),
      (id) => this.expireSellerMaxQualification(id),
    );
  }

  async processSellerMaxQualificationExpiration(orderId: string): Promise<boolean> {
    return (await this.expireSellerMaxQualification(orderId)) === 'PROCESSED';
  }

  async makeAvailable(orderId: string): Promise<boolean> {
    return (await this.makeAvailableResult(orderId)) === 'PROCESSED';
  }

  async recordDelivered(input: RecordDeliveryInput): Promise<FulfillmentResponse> {
    const normalized = { ...input, evidenceHash: input.evidenceHash.trim().toLowerCase() };
    if (!/^[a-f0-9]{64}$/.test(normalized.evidenceHash))
      throw this.conflict('DELIVERY_EVIDENCE_HASH_INVALID');
    const result = await this.prisma.$transaction((tx) =>
      this.recordDeliveredLocked(tx, normalized),
    );
    return this.unwrap(result);
  }

  async confirmReceipt(orderCode: string, actorUserId: string): Promise<FulfillmentResponse> {
    const result = await this.prisma.$transaction(async (tx) => {
      const visible = await tx.order.findFirst({
        where: { publicCode: orderCode, buyerUserId: actorUserId },
        select: { id: true },
      });
      if (!visible) throw new NotFoundException('Order not found');
      await acquireAdvisoryTransactionLock(tx, `order:${visible.id}`);
      const order = await this.lockOrder(tx, visible.id);
      if (!order || order.buyerUserId !== actorUserId)
        throw new NotFoundException('Order not found');

      if (
        order.status === OrderStatus.COMPLETED &&
        order.fulfillmentStatus === FulfillmentStatus.CONFIRMED
      )
        return this.response('REPLAY', order);
      if (
        order.status === OrderStatus.ACTIVE &&
        order.fulfillmentStatus === FulfillmentStatus.CONFIRMED
      ) {
        if (await this.hasActiveIssue(tx, order.id)) return this.response('REPLAY', order);
        const completion = await this.completeLocked(tx, order);
        if (completion.kind !== 'SUCCESS') return completion;
        return this.response('SUCCESS', { ...order, status: OrderStatus.COMPLETED });
      }

      const validation = await this.validateProgression(
        tx,
        order,
        FulfillmentStatus.AWAITING_BUYER_CONFIRMATION,
      );
      if (validation) return validation;
      const delivery = await tx.orderDelivery.findUnique({ where: { orderId: order.id } });
      if (!delivery)
        return this.systemIssue(tx, order.id, {
          type: 'MISSING_LOCAL',
          code: 'DELIVERY_RECORD_MISSING',
        });
      if (delivery.sellerProfileId !== order.sellerProfileId)
        return this.systemIssue(tx, order.id, {
          type: 'STATUS_MISMATCH',
          code: 'DELIVERY_SELLER_MISMATCH',
        });

      const buyerConfirmedAt = await this.sellerMaxWallClock(tx);
      const qualificationPending =
        order.sellerPlanSnapshot === 'LIT_MAX' &&
        order.sellerMaxQualificationVersion === 1 &&
        order.sellerMaxQualificationStatus === SellerMaxQualificationStatus.PENDING &&
        order.sellerMaxQualificationDeadlineAt !== null;
      const qualificationStatus = qualificationPending
        ? classifySellerMaxQualification(order.sellerMaxQualificationDeadlineAt!, buyerConfirmedAt)
        : order.sellerMaxQualificationStatus;
      const release =
        qualificationPending &&
        order.sellerMaxReleaseCalculationVersion === 1 &&
        order.frozenBaseReleaseDelayHours !== null
          ? calculateSellerMaxRelease({
              deliveredAt: delivery.createdAt,
              frozenBaseReleaseDelayHours: order.frozenBaseReleaseDelayHours,
              buyerConfirmedAt,
            })
          : null;

      await tx.order.update({
        where: { id: order.id },
        data: {
          fulfillmentStatus: 'CONFIRMED',
          buyerConfirmedAt,
          ...(qualificationPending
            ? {
                sellerMaxQualificationStatus: qualificationStatus,
                sellerMaxQualificationDecidedAt: buyerConfirmedAt,
                sellerMaxEffectiveReleaseAt:
                  qualificationStatus === SellerMaxQualificationStatus.QUALIFIED
                    ? release?.effectiveReleaseAt
                    : release?.baseReleaseEligibleAt,
              }
            : {}),
          version: { increment: 1 },
        },
      });
      await this.event(
        tx,
        order.id,
        'FULFILLMENT_CONFIRMED',
        'fulfillment.confirmed',
        actorUserId,
        {
          orderId: order.id,
          deliveryId: delivery.id,
          actorRole: 'BUYER',
        },
      );
      if (qualificationPending) {
        const qualified = qualificationStatus === SellerMaxQualificationStatus.QUALIFIED;
        await this.event(
          tx,
          order.id,
          qualified ? 'SELLER_MAX_QUALIFIED' : 'SELLER_MAX_QUALIFICATION_EXPIRED',
          qualified ? 'seller_max.qualified' : 'seller_max.qualification_expired',
          actorUserId,
          {
            orderId: order.id,
            deliveredAt: delivery.createdAt,
            qualificationDeadlineAt: order.sellerMaxQualificationDeadlineAt,
            buyerConfirmedAt,
            qualificationVersion: 1,
            previousStatus: 'PENDING',
            nextStatus: qualificationStatus,
            actorRole: 'BUYER',
            reason: qualified ? 'BUYER_CONFIRMED_WITHIN_WINDOW' : 'BUYER_CONFIRMED_AFTER_WINDOW',
          },
        );
      }
      const confirmed = { ...order, fulfillmentStatus: FulfillmentStatus.CONFIRMED };
      const completion = await this.completeLocked(tx, confirmed);
      if (completion.kind !== 'SUCCESS') return completion;
      return this.response('SUCCESS', { ...confirmed, status: OrderStatus.COMPLETED }, delivery.id);
    });
    return this.unwrap(result);
  }

  async processCompletion(orderId: string): Promise<boolean> {
    return (await this.processCompletionResult(orderId)) === 'PROCESSED';
  }

  private async recordDeliveredLocked(
    tx: Tx,
    input: RecordDeliveryInput,
  ): Promise<MutationResult<FulfillmentResponse>> {
    const visible = await this.findSellerOrder(tx, input.orderCode, input.actorUserId);
    if (!visible) throw new NotFoundException('Order not found');
    await acquireAdvisoryTransactionLock(tx, `order:${visible.id}`);
    const order = await this.lockOrder(tx, visible.id);
    if (!order || order.sellerUserId !== input.actorUserId)
      throw new NotFoundException('Order not found');

    const existing = await tx.orderDelivery.findUnique({ where: { orderId: order.id } });
    if (existing) {
      if (
        existing.deliveryType !== input.deliveryType ||
        existing.evidenceHash !== input.evidenceHash
      )
        return { kind: 'BUSINESS_BLOCK', code: 'DELIVERY_IDEMPOTENCY_MISMATCH' };
      if (
        !['DELIVERED', 'AWAITING_BUYER_CONFIRMATION', 'CONFIRMED'].includes(order.fulfillmentStatus)
      )
        return this.systemIssue(tx, order.id, {
          type: 'STATUS_MISMATCH',
          code: 'FULFILLMENT_STATE_MISMATCH',
        });
      return this.response('REPLAY', order, existing.id);
    }

    const validation = await this.validateProgression(tx, order, FulfillmentStatus.AWAITING_SELLER);
    if (validation) return validation;
    const delivery = await tx.orderDelivery.create({
      data: {
        orderId: order.id,
        sellerProfileId: order.sellerProfileId,
        deliveryType: input.deliveryType,
        evidenceHash: input.evidenceHash,
      },
    });
    const startsSellerMaxQualification = order.sellerPlanSnapshot === 'LIT_MAX';
    const qualificationDeadlineAt = new Date(delivery.createdAt.getTime() + 48 * 60 * 60 * 1000);
    const release =
      startsSellerMaxQualification && order.frozenBaseReleaseDelayHours !== null
        ? calculateSellerMaxRelease({
            deliveredAt: delivery.createdAt,
            frozenBaseReleaseDelayHours: order.frozenBaseReleaseDelayHours,
          })
        : null;
    await tx.order.update({
      where: { id: order.id },
      data: {
        fulfillmentStatus: 'DELIVERED',
        ...(startsSellerMaxQualification
          ? {
              sellerMaxQualificationVersion: 1,
              sellerMaxQualificationStatus: 'PENDING',
              sellerMaxQualificationDeadlineAt: qualificationDeadlineAt,
              ...(release
                ? {
                    sellerMaxReleaseCalculationVersion: 1,
                    sellerMaxReleaseReductionHours: release.reductionHours,
                    sellerMaxReleaseTargetAt: release.maxTargetAt,
                  }
                : {}),
            }
          : {}),
        version: { increment: 1 },
      },
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
    if (startsSellerMaxQualification)
      await this.event(
        tx,
        order.id,
        'SELLER_MAX_QUALIFICATION_STARTED',
        'seller_max.qualification_started',
        input.actorUserId,
        {
          orderId: order.id,
          deliveredAt: delivery.createdAt,
          qualificationDeadlineAt,
          qualificationVersion: 1,
          previousStatus: null,
          nextStatus: 'PENDING',
          actorRole: 'SELLER',
          reason: 'SELLER_DELIVERY_RECORDED',
        },
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
      kind: 'SUCCESS',
      value: {
        orderId: order.id,
        deliveryId: delivery.id,
        fulfillmentStatus: FulfillmentStatus.AWAITING_BUYER_CONFIRMATION,
      },
    };
  }

  private async makeAvailableResult(orderId: string): Promise<CandidateResult> {
    return this.prisma.$transaction(async (tx) => {
      await acquireAdvisoryTransactionLock(tx, `order:${orderId}`);
      const order = await this.lockOrder(tx, orderId);
      if (!order) return 'ALREADY_HANDLED';
      if (await this.hasActiveIssue(tx, order.id)) return 'ALREADY_HANDLED';
      if (order.fulfillmentStatus === FulfillmentStatus.AWAITING_SELLER) return 'ALREADY_HANDLED';
      const validation = await this.validateProgression(tx, order, FulfillmentStatus.NOT_AVAILABLE);
      if (validation) return 'ALREADY_HANDLED';
      await tx.order.update({
        where: { id: order.id },
        data: { fulfillmentStatus: 'AWAITING_SELLER', version: { increment: 1 } },
      });
      await this.event(tx, order.id, 'FULFILLMENT_AVAILABLE', 'fulfillment.available', undefined, {
        orderId: order.id,
        actorRole: 'SYSTEM',
      });
      return 'PROCESSED';
    });
  }

  private async processCompletionResult(orderId: string): Promise<CandidateResult> {
    return this.prisma.$transaction(async (tx) => {
      await acquireAdvisoryTransactionLock(tx, `order:${orderId}`);
      const order = await this.lockOrder(tx, orderId);
      if (!order || order.status === OrderStatus.COMPLETED) return 'ALREADY_HANDLED';
      if (await this.hasActiveIssue(tx, order.id)) return 'ALREADY_HANDLED';
      const result = await this.completeLocked(tx, order);
      return result.kind === 'SUCCESS' ? 'PROCESSED' : 'ALREADY_HANDLED';
    });
  }

  private async completeLocked(tx: Tx, order: LockedOrder): Promise<MutationResult<never>> {
    const validation = await this.validateProgression(tx, order, FulfillmentStatus.CONFIRMED);
    if (validation) return validation;
    const recognitions = await tx.ledgerTransaction.findMany({
      where: { type: SALE_TYPE, referenceType: SALE_REFERENCE_TYPE, referenceId: order.id },
    });
    const expectedKey = createHash('sha256')
      .update(`sale-recognition:v1:${order.id}`)
      .digest('hex');
    if (!recognitions.length)
      return this.systemIssue(tx, order.id, {
        type: 'MISSING_LOCAL',
        code: 'SALE_RECOGNITION_MISSING',
      });
    if (recognitions.length !== 1 || recognitions[0].idempotencyKeyHash !== expectedKey)
      return this.systemIssue(tx, order.id, { type: 'OTHER', code: 'SALE_RECOGNITION_INVALID' });
    await tx.order.update({
      where: { id: order.id },
      data: { status: 'COMPLETED', version: { increment: 1 } },
    });
    await this.event(tx, order.id, 'ORDER_COMPLETED', 'order.completed', undefined, {
      orderId: order.id,
      actorRole: 'SYSTEM',
    });
    return { kind: 'SUCCESS', value: undefined as never };
  }

  private async validateProgression(
    tx: Tx,
    order: LockedOrder,
    expectedFulfillment: FulfillmentStatus,
  ): Promise<MutationResult<never> | null> {
    if (order.status !== OrderStatus.ACTIVE)
      return { kind: 'BUSINESS_BLOCK', code: 'ORDER_STATE_MISMATCH' };
    if (order.paymentStatus !== PaymentStatus.PAID)
      return { kind: 'BUSINESS_BLOCK', code: 'PAYMENT_NOT_PAID' };
    if (order.fulfillmentStatus !== expectedFulfillment)
      return { kind: 'BUSINESS_BLOCK', code: 'FULFILLMENT_STATE_MISMATCH' };
    if (
      order.disputeStatus === DisputeStatus.OPEN ||
      order.disputeStatus === DisputeStatus.UNDER_REVIEW
    )
      return { kind: 'BUSINESS_BLOCK', code: 'ACTIVE_DISPUTE' };
    const payments = await tx.payment.findMany({ where: { orderId: order.id } });
    if (payments.length !== 1)
      return this.systemIssue(tx, order.id, { type: 'MISSING_LOCAL', code: 'PAYMENT_MISSING' });
    if (payments[0].status !== PaymentStatus.PAID)
      return this.systemIssue(tx, order.id, { type: 'STATUS_MISMATCH', code: 'PAYMENT_NOT_PAID' });
    return null;
  }

  private async systemIssue(
    tx: Tx,
    orderId: string,
    failure: Failure,
  ): Promise<MutationResult<never>> {
    await this.ensureIssue(tx, orderId, failure);
    return { kind: 'SYSTEM_INCONSISTENCY', code: failure.code };
  }

  private async processBatch(
    limit: number,
    next: () => Promise<string | null>,
    process: (id: string) => Promise<CandidateResult>,
  ): Promise<number> {
    const bounded = Math.max(1, Math.min(limit, 100));
    let processed = 0;
    while (processed < bounded) {
      const id = await next();
      if (!id) break;
      const result = await process(id);
      if (result === 'PROCESSED') processed += 1;
    }
    return processed;
  }

  private async nextAvailabilityCandidate(): Promise<string | null> {
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT o."id" FROM "Order" o
      WHERE o."status" = 'ACTIVE' AND o."paymentStatus" = 'PAID'
        AND o."fulfillmentStatus" = 'NOT_AVAILABLE'
        AND o."disputeStatus" NOT IN ('OPEN', 'UNDER_REVIEW')
        AND NOT EXISTS (
          SELECT 1 FROM "ReconciliationIssue" r
          WHERE r."referenceType" = ${REFERENCE_TYPE} AND r."referenceId" = o."id"::text
            AND r."status" IN ('OPEN', 'INVESTIGATING')
        )
      ORDER BY o."updatedAt", o."id" LIMIT 1
    `;
    return rows[0]?.id ?? null;
  }

  private async nextCompletionCandidate(): Promise<string | null> {
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT o."id" FROM "Order" o
      WHERE o."status" = 'ACTIVE' AND o."paymentStatus" = 'PAID'
        AND o."fulfillmentStatus" = 'CONFIRMED'
        AND o."disputeStatus" NOT IN ('OPEN', 'UNDER_REVIEW')
        AND NOT EXISTS (
          SELECT 1 FROM "ReconciliationIssue" r
          WHERE r."referenceType" = ${REFERENCE_TYPE} AND r."referenceId" = o."id"::text
            AND r."status" IN ('OPEN', 'INVESTIGATING')
        )
      ORDER BY o."updatedAt", o."id" LIMIT 1
    `;
    return rows[0]?.id ?? null;
  }

  private async nextSellerMaxExpirationCandidate(): Promise<string | null> {
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "Order"
      WHERE "sellerMaxQualificationVersion" = 1
        AND "sellerMaxQualificationStatus" = 'PENDING'
        AND "buyerConfirmedAt" IS NULL
        AND "sellerMaxQualificationDeadlineAt" < clock_timestamp()
      ORDER BY "sellerMaxQualificationDeadlineAt", "id" LIMIT 1
    `;
    return rows[0]?.id ?? null;
  }

  private async expireSellerMaxQualification(orderId: string): Promise<CandidateResult> {
    return this.prisma.$transaction(async (tx) => {
      await acquireAdvisoryTransactionLock(tx, `order:${orderId}`);
      const order = await this.lockOrder(tx, orderId);
      if (
        !order ||
        order.sellerMaxQualificationVersion !== 1 ||
        order.sellerMaxQualificationStatus !== SellerMaxQualificationStatus.PENDING ||
        order.buyerConfirmedAt !== null ||
        order.sellerMaxQualificationDeadlineAt === null
      )
        return 'ALREADY_HANDLED';
      const now = await this.sellerMaxWallClock(tx);
      if (!isSellerMaxQualificationExpired(order.sellerMaxQualificationDeadlineAt, now))
        return 'ALREADY_HANDLED';
      await tx.order.update({
        where: { id: order.id },
        data: {
          sellerMaxQualificationStatus: 'EXPIRED',
          sellerMaxQualificationDecidedAt: now,
          ...(order.sellerMaxReleaseCalculationVersion === 1 &&
          order.frozenBaseReleaseDelayHours !== null
            ? {
                sellerMaxEffectiveReleaseAt: calculateSellerMaxRelease({
                  deliveredAt: (await tx.orderDelivery.findUniqueOrThrow({ where: { orderId } }))
                    .createdAt,
                  frozenBaseReleaseDelayHours: order.frozenBaseReleaseDelayHours,
                }).baseReleaseEligibleAt,
              }
            : {}),
          version: { increment: 1 },
        },
      });
      const delivery = await tx.orderDelivery.findUniqueOrThrow({ where: { orderId } });
      await this.event(
        tx,
        order.id,
        'SELLER_MAX_QUALIFICATION_EXPIRED',
        'seller_max.qualification_expired',
        undefined,
        {
          orderId: order.id,
          deliveredAt: delivery.createdAt,
          qualificationDeadlineAt: order.sellerMaxQualificationDeadlineAt,
          qualificationVersion: 1,
          previousStatus: 'PENDING',
          nextStatus: 'EXPIRED',
          actorRole: 'SYSTEM',
          reason: 'BUYER_CONFIRMATION_WINDOW_ELAPSED',
        },
      );
      return 'PROCESSED';
    });
  }

  private async lockOrder(tx: Tx, orderId: string): Promise<LockedOrder | null> {
    const rows = await tx.$queryRaw<LockedOrder[]>`
      SELECT o."id", o."publicCode", o."buyerUserId", o."sellerProfileId",
             sp."userId" AS "sellerUserId", o."status", o."paymentStatus",
             o."fulfillmentStatus", o."disputeStatus", o."version"
             , o."sellerPlanSnapshot", o."sellerMaxQualificationVersion",
             o."sellerMaxQualificationStatus", o."sellerMaxQualificationDeadlineAt",
             o."sellerMaxQualificationDecidedAt", o."buyerConfirmedAt"
             , o."frozenBaseReleaseDelayHours", o."sellerMaxReleaseCalculationVersion",
             o."sellerMaxReleaseReductionHours", o."sellerMaxReleaseTargetAt",
             o."sellerMaxEffectiveReleaseAt"
      FROM "Order" o JOIN "SellerProfile" sp ON sp."id" = o."sellerProfileId"
      WHERE o."id" = ${orderId}::uuid FOR UPDATE OF o
    `;
    return rows[0] ?? null;
  }

  private async sellerMaxWallClock(tx: Tx): Promise<Date> {
    const [{ now }] = await tx.$queryRaw<Array<{ now: Date }>>`
      SELECT clock_timestamp()::timestamp(3) AS "now"
    `;
    return now;
  }

  private findSellerOrder(tx: Tx, publicCode: string, actorUserId: string) {
    return tx.order.findFirst({
      where: { publicCode, sellerProfile: { userId: actorUserId } },
      select: { id: true },
    });
  }

  private hasActiveIssue(tx: Tx, orderId: string) {
    return tx.reconciliationIssue
      .count({
        where: {
          referenceType: REFERENCE_TYPE,
          referenceId: orderId,
          status: { in: ['OPEN', 'INVESTIGATING'] },
        },
      })
      .then((count) => count > 0);
  }

  private async ensureIssue(tx: Tx, orderId: string, failure: Failure) {
    await acquireAdvisoryTransactionLock(tx, `order-fulfillment-issue:${orderId}`);
    const existing = await this.hasActiveIssue(tx, orderId);
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

  private response(
    kind: 'SUCCESS' | 'REPLAY',
    order: Pick<LockedOrder, 'id' | 'status' | 'fulfillmentStatus'>,
    deliveryId?: string,
  ): MutationResult<FulfillmentResponse> {
    return {
      kind,
      value: {
        orderId: order.id,
        deliveryId,
        status: order.status,
        fulfillmentStatus: order.fulfillmentStatus,
      },
    };
  }

  private unwrap<T>(result: MutationResult<T>): T {
    if (result.kind === 'SUCCESS' || result.kind === 'REPLAY') return result.value;
    throw this.conflict(result.code);
  }

  private conflict(code: string) {
    return new ConflictException({ code });
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
