import { Inject, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { ProviderPaymentStatus } from '@prisma/client';
import { AppError } from '../common/errors/app-error';
import { type ParsedIdempotencyKey } from '../commerce/idempotency-key';
import { PrismaService } from '../database/prisma.service';
import { PaidOrderActivationService } from '../orders/paid-order-activation.service';
import { ALPHA_PAYMENT_CONFIG, type AlphaPaymentConfig } from './alpha-payment.config';
import { FakePaymentProvider } from './fake-payment-provider';
import { FinancialDomainError } from './financial.errors';
import {
  PAYMENT_PROVIDER_PORT,
  PaymentOrchestrationService,
} from './payment-orchestration.service';
import type { PaymentProviderPort } from './payment-provider.port';
import { ProviderWebhookEventProcessor } from './provider-webhook-event.processor';
@Injectable()
export class BuyerPaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orchestration: PaymentOrchestrationService,
    private readonly events: ProviderWebhookEventProcessor,
    private readonly activation: PaidOrderActivationService,
    @Inject(PAYMENT_PROVIDER_PORT) private readonly provider: PaymentProviderPort,
    @Inject(ALPHA_PAYMENT_CONFIG) private readonly alpha: AlphaPaymentConfig,
  ) {}
  async read(buyerUserId: string, orderCode: string) {
    const order = await this.ownedOrder(buyerUserId, orderCode);
    const payment = await this.prisma.payment.findUnique({
      where: { orderId: order.id },
      include: { attempts: { orderBy: { attemptNumber: 'desc' }, take: 1 } },
    });
    const attempt = payment?.attempts[0] ?? null;
    return {
      orderCode: order.publicCode,
      orderStatus: order.status,
      paymentStatus: payment?.status ?? order.paymentStatus,
      paymentId: payment?.id ?? null,
      attemptId: attempt?.id ?? null,
      attemptNumber: attempt?.attemptNumber ?? null,
      providerCode: attempt?.providerCode ?? null,
      method: null,
      status: attempt?.status ?? null,
      amountMinor: (payment?.amountMinor ?? order.totalAmountMinor).toString(),
      currency: order.currency,
      alphaSimulationAvailable: this.alpha.enabled,
    };
  }
  async initiate(buyerUserId: string, orderCode: string, key: ParsedIdempotencyKey) {
    const order = await this.ownedOrder(buyerUserId, orderCode);
    try {
      return await this.orchestration.initiateBilling(buyerUserId, order.id, key);
    } catch (error) {
      this.mapFinancial(error);
    }
  }
  async confirm(
    buyerUserId: string,
    orderCode: string,
    attemptId: string,
    key: ParsedIdempotencyKey,
  ) {
    if (
      !this.alpha.enabled ||
      process.env.NODE_ENV === 'production' ||
      !(this.provider instanceof FakePaymentProvider) ||
      this.provider.providerCode !== 'FAKE_ALPHA'
    )
      throw new AppError('ALPHA_SIMULATION_UNAVAILABLE', 'ALPHA_SIMULATION_UNAVAILABLE', 404);
    const order = await this.ownedOrder(buyerUserId, orderCode);
    const attempt = await this.prisma.paymentAttempt.findFirst({
      where: { id: attemptId, payment: { orderId: order.id } },
    });
    if (!attempt?.externalPaymentId) throw new AppError('ORDER_NOT_FOUND', 'ORDER_NOT_FOUND', 404);
    const external = this.provider.simulate(attempt.externalPaymentId, 'SUCCEEDED');
    const eventId = createHash('sha256')
      .update(`${buyerUserId}:ALPHA_CONFIRM:${key.hash}`)
      .digest('hex');
    const unique = { providerCode: 'FAKE_ALPHA', externalEventId: eventId };
    const existing = await this.prisma.providerWebhookEvent.findUnique({
      where: { providerCode_externalEventId: unique },
    });
    if (existing && existing.externalPaymentId !== external.id)
      throw new AppError('IDEMPOTENCY_KEY_REUSED', 'IDEMPOTENCY_KEY_REUSED', 409);
    await this.prisma.providerWebhookEvent.upsert({
      where: { providerCode_externalEventId: unique },
      create: {
        ...unique,
        eventType: 'ALPHA_PAYMENT_SUCCEEDED',
        externalPaymentId: external.id,
        normalizedPaymentStatus: ProviderPaymentStatus.SUCCEEDED,
        occurredAt: new Date(),
        payloadHash: eventId,
      },
      update: {},
    });
    await this.events.processBatch();
    await this.activation.processOne(order.id);
    return this.read(buyerUserId, orderCode);
  }
  private async ownedOrder(buyerUserId: string, publicCode: string) {
    const order = await this.prisma.order.findFirst({
      where: { buyerUserId, publicCode },
      select: {
        id: true,
        publicCode: true,
        status: true,
        paymentStatus: true,
        totalAmountMinor: true,
        currency: true,
      },
    });
    if (!order) throw new AppError('ORDER_NOT_FOUND', 'ORDER_NOT_FOUND', 404);
    return order;
  }
  private mapFinancial(error: unknown): never {
    if (error instanceof FinancialDomainError)
      throw new AppError(
        error.code,
        error.code,
        ['IDEMPOTENCY_KEY_REUSED', 'PAYMENT_ATTEMPT_IN_PROGRESS'].includes(error.code) ? 409 : 422,
      );
    throw error;
  }
}
