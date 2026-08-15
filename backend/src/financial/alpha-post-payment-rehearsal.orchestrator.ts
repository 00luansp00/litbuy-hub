import { ConflictException, Injectable } from '@nestjs/common';
import { FulfillmentStatus, OrderStatus, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { OrderFulfillmentService } from '../orders/order-fulfillment.service';
import { PaidOrderActivationService } from '../orders/paid-order-activation.service';
import {
  SALE_RECOGNITION_LEDGER_TYPE,
  SALE_RECOGNITION_RECONCILIATION_REFERENCE_TYPE,
  SALE_RECOGNITION_REFERENCE_TYPE,
  SaleFinancialRecognitionService,
  saleRecognitionIdempotencyKey,
} from './sale-financial-recognition.service';

/** Synchronous composition exclusively for the local FAKE_ALPHA rehearsal path. */
@Injectable()
export class AlphaPostPaymentRehearsalOrchestrator {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activation: PaidOrderActivationService,
    private readonly recognition: SaleFinancialRecognitionService,
    private readonly fulfillment: OrderFulfillmentService,
  ) {}

  async progress(orderId: string): Promise<void> {
    await this.activation.processOne(orderId);
    const activated = await this.readOrder(orderId);
    if (activated?.status !== OrderStatus.ACTIVE || activated.paymentStatus !== PaymentStatus.PAID)
      throw this.progressionRequired();

    await this.recognition.processOne(orderId);
    const [recognitions, incompatibleReconciliation] = await Promise.all([
      this.prisma.ledgerTransaction.findMany({
        where: {
          type: SALE_RECOGNITION_LEDGER_TYPE,
          referenceType: SALE_RECOGNITION_REFERENCE_TYPE,
          referenceId: orderId,
        },
        select: { idempotencyKeyHash: true },
      }),
      this.prisma.reconciliationIssue.findFirst({
        where: {
          referenceType: SALE_RECOGNITION_RECONCILIATION_REFERENCE_TYPE,
          referenceId: orderId,
          status: { in: ['OPEN', 'INVESTIGATING'] },
        },
        select: { id: true },
      }),
    ]);
    if (
      incompatibleReconciliation ||
      recognitions.length !== 1 ||
      recognitions[0].idempotencyKeyHash !== saleRecognitionIdempotencyKey(orderId)
    )
      throw this.progressionRequired();

    await this.fulfillment.makeAvailable(orderId);
    const available = await this.readOrder(orderId);
    if (
      available?.status !== OrderStatus.ACTIVE ||
      available.paymentStatus !== PaymentStatus.PAID ||
      available.fulfillmentStatus !== FulfillmentStatus.AWAITING_SELLER
    )
      throw this.progressionRequired();
  }

  private readOrder(orderId: string) {
    return this.prisma.order.findUnique({
      where: { id: orderId },
      select: { status: true, paymentStatus: true, fulfillmentStatus: true },
    });
  }

  private progressionRequired() {
    return new ConflictException({ code: 'ALPHA_POST_PAYMENT_PROGRESSION_REQUIRED' });
  }
}
