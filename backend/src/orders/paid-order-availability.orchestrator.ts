import { ConflictException, Injectable } from '@nestjs/common';
import { FulfillmentStatus, OrderStatus, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { OrderFulfillmentService } from './order-fulfillment.service';
import { PaidOrderActivationService } from './paid-order-activation.service';

@Injectable()
export class PaidOrderAvailabilityOrchestrator {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activation: PaidOrderActivationService,
    private readonly fulfillment: OrderFulfillmentService,
  ) {}

  async ensureAvailable(orderId: string): Promise<void> {
    await this.activation.processOne(orderId);
    const activated = await this.readState(orderId);
    if (activated?.status !== OrderStatus.ACTIVE || activated.paymentStatus !== PaymentStatus.PAID)
      throw this.progressionRequired();

    await this.fulfillment.makeAvailable(orderId);
    const available = await this.readState(orderId);
    if (
      available?.status !== OrderStatus.ACTIVE ||
      available.paymentStatus !== PaymentStatus.PAID ||
      available.fulfillmentStatus !== FulfillmentStatus.AWAITING_SELLER
    )
      throw this.progressionRequired();
  }

  private readState(orderId: string) {
    return this.prisma.order.findUnique({
      where: { id: orderId },
      select: { status: true, paymentStatus: true, fulfillmentStatus: true },
    });
  }

  private progressionRequired() {
    return new ConflictException({ code: 'POST_PAYMENT_AVAILABILITY_REQUIRED' });
  }
}
