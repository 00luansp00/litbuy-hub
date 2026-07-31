import { Injectable } from '@nestjs/common';
import {
  CartStatus,
  CommerceIdempotencyOperation,
  InventoryReservationStatus,
  ListingDraftModel,
  ListingDraftServicePricingType,
  Order,
  OrderEventType,
  Prisma,
  SecurityEventOutcome,
  SecurityEventType,
} from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AppError } from '../common/errors/app-error';
import { assertCartSelection } from '../carts/cart-purchasability';
import type { CartSelection } from '../carts/cart-purchasability';
import { cartResponseInclude } from '../carts/carts.service';
import type { CartResponsePayload } from '../carts/carts.service';
import { checkoutFingerprint } from './checkout-fingerprint';
import { canonicalRequestHash } from '../commerce/idempotency-key';
import type { ParsedIdempotencyKey } from '../commerce/idempotency-key';
import { orderItemSnapshot } from './order-snapshot';
import { generateOrderCode } from '../orders/order-code';
import type { CreateCheckoutDto } from './checkout.dto';

type Tx = Prisma.TransactionClient;
type CheckoutCartItem = CartResponsePayload['items'][number];
type ValidatedSelection = { item: CheckoutCartItem; selection: CartSelection };
type PublicSeller = Pick<CartResponsePayload['sellerProfile'], 'id' | 'slug' | 'storeName'>;
export type CheckoutResponse = ReturnType<CheckoutService['response']>;
@Injectable()
export class CheckoutService {
  constructor(private readonly prisma: PrismaService) {}
  async create(userId: string, key: ParsedIdempotencyKey, dto: CreateCheckoutDto) {
    const keyHash = key.hash,
      requestHash = canonicalRequestHash(dto);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'idempotency:' + userId + ':CHECKOUT_CREATE:' + keyHash}))`;
      const prior = await tx.commerceIdempotencyRecord.findUnique({
        where: {
          actorUserId_operation_keyHash: {
            actorUserId: userId,
            operation: CommerceIdempotencyOperation.CHECKOUT_CREATE,
            keyHash,
          },
        },
      });
      if (prior) {
        if (prior.requestHash !== requestHash) this.fail('IDEMPOTENCY_KEY_REUSED', 409);
        if (prior.completedAt && prior.responseBody) return prior.responseBody;
      }
      const seller = await tx.sellerProfile.findUnique({ where: { slug: dto.sellerSlug } });
      if (!seller) this.fail('CART_NOT_CHECKOUT_READY', 422);
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'buyer-cart:' + userId + ':' + seller.id}))`;
      const cart = await tx.cart.findFirst({
        where: { buyerUserId: userId, sellerProfileId: seller.id, status: CartStatus.ACTIVE },
        include: cartResponseInclude,
      });
      if (!cart) this.fail('CART_NOT_CHECKOUT_READY', 422);
      if (cart.version !== dto.expectedCartVersion) this.fail('CART_VERSION_CONFLICT', 409);
      if (!cart.items.length) this.fail('CART_EMPTY', 422);
      const selections = cart.items.map((item) => {
        const selection = assertCartSelection(item.product, {
          sellerProfileId: seller.id,
          buyerUserId: userId,
          productVariantId: item.productVariantId ?? undefined,
          quantity: item.quantity,
        });
        return { item, selection };
      });
      const fingerprint = checkoutFingerprint({
        cartId: cart.id,
        cartVersion: cart.version,
        sellerId: seller.id,
        currency: 'BRL',
        items: selections.map(({ item, selection }) => ({
          id: item.id,
          productId: item.productId,
          productVersion: item.product.version,
          variantId: item.productVariantId,
          quantity: item.quantity,
          unitAmountMinor: selection.unitMinor.toString(),
          purchasable: true,
          issues: [],
        })),
      });
      if (fingerprint !== dto.expectedPreviewFingerprint)
        this.fail('CHECKOUT_PREVIEW_CHANGED', 409);
      const reservable = selections
        .filter(({ item }) => item.product.model !== ListingDraftModel.SERVICE)
        .map((x) => ({
          ...x,
          key:
            x.item.product.model === ListingDraftModel.DYNAMIC
              ? `variant:${x.item.productVariantId}`
              : `product:${x.item.productId}`,
        }))
        .sort((a, b) => a.key.localeCompare(b.key));
      for (const selected of reservable) {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'checkout-stock:' + selected.key}))`;
        const active = await tx.inventoryReservation.aggregate({
          where: {
            productId: selected.item.productId,
            productVariantId: selected.item.productVariantId,
            status: InventoryReservationStatus.ACTIVE,
            expiresAt: { gt: new Date() },
          },
          _sum: { quantity: true },
        });
        const stock =
          selected.item.product.model === ListingDraftModel.DYNAMIC
            ? selected.selection.variant?.stock
            : selected.item.product.stock;
        if (
          stock === null ||
          stock === undefined ||
          stock - (active._sum.quantity ?? 0) < selected.item.quantity
        )
          this.fail('INSUFFICIENT_STOCK', 409);
      }
      const subtotal = selections.reduce(
        (sum, x) => sum + x.selection.unitMinor * BigInt(x.item.quantity),
        0n,
      );
      const expiresAt = new Date(Date.now() + this.ttlMinutes() * 60_000);
      let order: Order | undefined;
      for (let attempt = 0; attempt < 5; attempt++) {
        await tx.$executeRawUnsafe('SAVEPOINT checkout_public_code');
        try {
          order = await tx.order.create({
            data: {
              publicCode: generateOrderCode(),
              sourceCartId: cart.id,
              sourceCartVersion: cart.version,
              buyerUserId: userId,
              sellerProfileId: seller.id,
              subtotalAmountMinor: subtotal,
              totalAmountMinor: subtotal,
              expiresAt,
            },
          });
          await tx.$executeRawUnsafe('RELEASE SAVEPOINT checkout_public_code');
          break;
        } catch (error) {
          await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT checkout_public_code');
          if (!this.isUniqueViolation(error)) throw error;
          const target = this.uniqueTarget(error);
          if (target.includes('sourceCartId')) this.fail('CHECKOUT_CONFLICT', 409);
          if (!target.includes('publicCode')) this.fail('CHECKOUT_CONFLICT', 409);
          if (attempt === 4) this.fail('CHECKOUT_CONFLICT', 409);
        }
      }
      if (!order) this.fail('CHECKOUT_CONFLICT', 409);
      const reservations: string[] = [];
      for (const { item, selection } of selections) {
        const created = await tx.orderItem.create({
          data: {
            orderId: order.id,
            ...orderItemSnapshot(
              item.product,
              item.variant,
              { id: seller.id, slug: seller.slug, storeName: seller.storeName },
              selection.unitMinor,
              item.quantity,
            ),
          },
        });
        if (item.product.model !== ListingDraftModel.SERVICE) {
          const reservation = await tx.inventoryReservation.create({
            data: {
              orderId: order.id,
              orderItemId: created.id,
              productId: item.productId,
              productVariantId: item.productVariantId,
              quantity: item.quantity,
              expiresAt,
            },
          });
          reservations.push(reservation.id);
        } else if (
          item.product.serviceDetails?.pricingType === ListingDraftServicePricingType.QUOTE
        )
          this.fail('PRODUCT_REQUIRES_QUOTE', 422);
      }
      const bumped = await tx.cart.updateMany({
        where: { id: cart.id, version: cart.version, status: CartStatus.ACTIVE },
        data: {
          status: CartStatus.CHECKED_OUT,
          checkedOutAt: new Date(),
          version: { increment: 1 },
        },
      });
      if (bumped.count !== 1) this.fail('CHECKOUT_CONFLICT', 409);
      await this.event(tx, order.id, OrderEventType.ORDER_CREATED, userId, {
        orderId: order.id,
        orderCode: order.publicCode,
        cartId: cart.id,
        version: 1,
      });
      if (reservations.length)
        await this.event(tx, order.id, OrderEventType.INVENTORY_RESERVED, userId, {
          orderId: order.id,
          reservationIds: reservations,
        });
      await tx.securityEvent.create({
        data: {
          userId,
          eventType: SecurityEventType.CHECKOUT_ORDER_CREATED,
          outcome: SecurityEventOutcome.SUCCESS,
          metadata: { orderId: order.id, cartId: cart.id },
        },
      });
      const response = this.response(order, seller, selections);
      await tx.commerceIdempotencyRecord.create({
        data: {
          actorUserId: userId,
          operation: CommerceIdempotencyOperation.CHECKOUT_CREATE,
          keyHash,
          requestHash,
          responseStatus: 201,
          responseBody: response,
          resourceType: 'ORDER',
          resourceId: order.id,
          completedAt: new Date(),
          expiresAt: new Date(Date.now() + 86_400_000),
        },
      });
      return response;
    });
  }
  response(order: Order, seller: PublicSeller, selections: ValidatedSelection[]) {
    return {
      orderCode: order.publicCode,
      seller: { slug: seller.slug, storeName: seller.storeName },
      status: order.status,
      paymentStatus: order.paymentStatus,
      fulfillmentStatus: order.fulfillmentStatus,
      disputeStatus: order.disputeStatus,
      currency: order.currency,
      subtotalAmountMinor: order.subtotalAmountMinor.toString(),
      discountAmountMinor: order.discountAmountMinor.toString(),
      platformFeeAmountMinor: order.platformFeeAmountMinor.toString(),
      totalAmountMinor: order.totalAmountMinor.toString(),
      version: order.version,
      expiresAt: order.expiresAt.toISOString(),
      createdAt: order.createdAt.toISOString(),
      items: selections.map(({ item, selection }) => ({
        productSlug: item.product.slug,
        productTitle: item.product.title,
        variantTitle: item.variant?.title ?? null,
        quantity: item.quantity,
        unitAmountMinor: selection.unitMinor.toString(),
        lineTotalAmountMinor: (selection.unitMinor * BigInt(item.quantity)).toString(),
        currency: 'BRL',
      })),
    };
  }
  private async event(
    tx: Tx,
    orderId: string,
    type: OrderEventType,
    actorUserId: string | null,
    metadata: Prisma.InputJsonObject,
  ) {
    const event = await tx.orderEvent.create({ data: { orderId, type, actorUserId, metadata } });
    await tx.outboxEvent.create({
      data: {
        orderEventId: event.id,
        aggregateType: 'ORDER',
        aggregateId: orderId,
        eventType: type,
        payload: { orderId, eventId: event.id, type },
      },
    });
  }
  private ttlMinutes() {
    const value = Number(process.env.CHECKOUT_RESERVATION_TTL_MINUTES ?? '15');
    return Number.isInteger(value) && value > 0 ? value : 15;
  }
  private isUniqueViolation(error: unknown): error is Prisma.PrismaClientKnownRequestError {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }
  private uniqueTarget(error: Prisma.PrismaClientKnownRequestError): string[] {
    const target = error.meta?.target;
    return Array.isArray(target)
      ? target.filter((value): value is string => typeof value === 'string')
      : typeof target === 'string'
        ? [target]
        : [];
  }
  private fail(code: string, status: number): never {
    throw new AppError(code, code, status);
  }
}
