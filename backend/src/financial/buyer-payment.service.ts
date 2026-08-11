import { Inject, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import {
  OrderStatus,
  PaymentAttemptStatus,
  PaymentStatus,
  ProviderPaymentStatus,
} from '@prisma/client';
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
const ALPHA_CONFIRMABLE = new Set<PaymentAttemptStatus>([
  PaymentAttemptStatus.PENDING,
  PaymentAttemptStatus.PROCESSING,
  PaymentAttemptStatus.REQUIRES_ACTION,
]);
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
      attemptId: attempt?.id ?? null,
      attemptNumber: attempt?.attemptNumber ?? null,
      providerCode: attempt?.providerCode ?? null,
      method: null,
      status: attempt?.status ?? null,
      amountMinor: (payment?.amountMinor ?? order.totalAmountMinor).toString(),
      currency: order.currency,
      alphaSimulationAvailable:
        this.alpha.enabled &&
        attempt?.providerCode === 'FAKE_ALPHA' &&
        ALPHA_CONFIRMABLE.has(attempt.status),
    };
  }
  async initiate(buyerUserId: string, orderCode: string, key: ParsedIdempotencyKey) {
    const order = await this.ownedOrder(buyerUserId, orderCode);
    try {
      await this.orchestration.initiateBilling(buyerUserId, order.id, key);
      return this.read(buyerUserId, orderCode);
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
    const eventId = createHash('sha256')
      .update(`${buyerUserId}:ALPHA_CONFIRM:${key.hash}`)
      .digest('hex');
    const unique = { providerCode: 'FAKE_ALPHA', externalEventId: eventId };
    const prepared = await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "Order" WHERE "id" = (
        SELECT "orderId" FROM "Payment" WHERE "id" = (SELECT "paymentId" FROM "PaymentAttempt" WHERE "id" = ${attemptId}::uuid)
      ) FOR UPDATE`;
      if (!rows.length) throw new AppError('ORDER_NOT_FOUND', 'ORDER_NOT_FOUND', 404);
      const order = await tx.order.findFirst({ where: { buyerUserId, publicCode: orderCode } });
      const attempt = await tx.paymentAttempt.findFirst({
        where: { id: attemptId, payment: { orderId: order?.id } },
        include: { payment: true },
      });
      if (!order || !attempt?.externalPaymentId)
        throw new AppError('ORDER_NOT_FOUND', 'ORDER_NOT_FOUND', 404);
      const existing = await tx.providerWebhookEvent.findUnique({
        where: { providerCode_externalEventId: unique },
      });
      if (existing && existing.externalPaymentId !== attempt.externalPaymentId)
        throw new AppError('IDEMPOTENCY_KEY_REUSED', 'IDEMPOTENCY_KEY_REUSED', 409);
      if (existing) return { orderId: order.id, attempt, event: existing, replay: true };
      const priorConfirmation = await tx.providerWebhookEvent.findFirst({
        where: {
          providerCode: 'FAKE_ALPHA',
          externalPaymentId: attempt.externalPaymentId,
          eventType: 'ALPHA_PAYMENT_SUCCEEDED',
        },
      });
      if (priorConfirmation)
        throw new AppError('ORDER_NOT_PAYMENT_ELIGIBLE', 'ORDER_NOT_PAYMENT_ELIGIBLE', 422);
      if (
        order.status !== OrderStatus.PENDING_PAYMENT ||
        attempt.payment.status !== PaymentStatus.PENDING ||
        attempt.providerCode !== 'FAKE_ALPHA' ||
        !ALPHA_CONFIRMABLE.has(attempt.status)
      )
        throw new AppError('ORDER_NOT_PAYMENT_ELIGIBLE', 'ORDER_NOT_PAYMENT_ELIGIBLE', 422);
      const event = await tx.providerWebhookEvent.create({
        data: {
          ...unique,
          eventType: 'ALPHA_PAYMENT_SUCCEEDED',
          externalPaymentId: attempt.externalPaymentId,
          normalizedPaymentStatus: ProviderPaymentStatus.SUCCEEDED,
          occurredAt: new Date(),
          payloadHash: eventId,
        },
      });
      return { orderId: order.id, attempt, event, replay: false };
    });
    if (!prepared.replay) this.provider.simulate(prepared.attempt.externalPaymentId!, 'SUCCEEDED');
    if (prepared.event.status !== 'PROCESSED') await this.events.processOne(prepared.event.id);
    const confirmed = await this.prisma.paymentAttempt.findUnique({
      where: { id: attemptId },
      include: { payment: true },
    });
    if (
      confirmed?.status !== PaymentAttemptStatus.SUCCEEDED ||
      confirmed.payment.status !== PaymentStatus.PAID
    )
      throw new AppError('PAYMENT_RECONCILIATION_REQUIRED', 'PAYMENT_RECONCILIATION_REQUIRED', 422);
    await this.activation.processOne(prepared.orderId);
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
