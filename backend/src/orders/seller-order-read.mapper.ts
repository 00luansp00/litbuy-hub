import type { Prisma } from '@prisma/client';
import { AppError } from '../common/errors/app-error';

export const sellerOrderReadInclude = {
  items: { orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }] },
} satisfies Prisma.OrderInclude;

type Payload = Prisma.OrderGetPayload<{ include: typeof sellerOrderReadInclude }>;

export function mapSellerOrder(order: Payload) {
  if (
    !order.items.length ||
    order.items.some((item) => item.sellerProfileId !== order.sellerProfileId)
  )
    throw new AppError('ORDER_SNAPSHOT_INVALID', 'ORDER_SNAPSHOT_INVALID', 500);
  return {
    orderCode: order.publicCode,
    currency: order.currency,
    saleAmountMinor: (order.subtotalAmountMinor - order.discountAmountMinor).toString(),
    status: order.status,
    paymentStatus: order.paymentStatus,
    fulfillmentStatus: order.fulfillmentStatus,
    disputeStatus: order.disputeStatus,
    version: order.version,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    items: order.items.map((item) => ({
      productSlug: item.productSlug,
      productTitle: item.productTitle,
      variantTitle: item.variantTitle,
      productType: item.productType,
      productModel: item.productModel,
      deliveryMode: item.deliveryMode,
      quantity: item.quantity,
      unitAmountMinor: item.unitAmountMinor.toString(),
      lineTotalAmountMinor: item.lineTotalAmountMinor.toString(),
      currency: item.currency,
      serviceEstimatedDelivery: item.serviceEstimatedDelivery,
      serviceBuyerRequirements: item.serviceBuyerRequirements,
    })),
  };
}
