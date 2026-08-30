import type { Prisma } from '@prisma/client';
import { AppError } from '../common/errors/app-error';

export const orderReadInclude = {
  items: { orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }] },
  feeComponentSnapshots: { where: { componentKind: 'BUYER_VIP' as const } },
  disputeCases: { orderBy: [{ createdAt: 'desc' as const }, { id: 'desc' as const }] },
} satisfies Prisma.OrderInclude;

export type OrderReadPayload = Prisma.OrderGetPayload<{ include: typeof orderReadInclude }>;
export type OrderReadResponse = ReturnType<typeof mapOrder>;

export function mapOrder(order: OrderReadPayload) {
  if (order.items.length !== 1) throw invalidSnapshot();
  const firstItem = order.items[0];
  const inconsistentSellerSnapshot = order.items.some(
    (item) =>
      item.sellerProfileId !== firstItem.sellerProfileId ||
      item.sellerSlug !== firstItem.sellerSlug ||
      item.sellerStoreName !== firstItem.sellerStoreName,
  );
  if (inconsistentSellerSnapshot) throw invalidSnapshot();
  return {
    orderCode: order.publicCode,
    seller: { slug: firstItem.sellerSlug, storeName: firstItem.sellerStoreName },
    currency: order.currency,
    subtotalAmountMinor: order.subtotalAmountMinor.toString(),
    discountAmountMinor: order.discountAmountMinor.toString(),
    platformFeeAmountMinor: order.platformFeeAmountMinor.toString(),
    totalAmountMinor: order.totalAmountMinor.toString(),
    buyerVipPlan: order.buyerVipPlanSnapshot,
    buyerVipFeeAmountMinor: (order.feeComponentSnapshots[0]?.feeAmountMinor ?? 0n).toString(),
    status: order.status,
    paymentStatus: order.paymentStatus,
    fulfillmentStatus: order.fulfillmentStatus,
    disputeStatus: order.disputeStatus,
    disputeCases: order.disputeCases.map((dispute) => ({
      caseId: dispute.id,
      status: dispute.status,
      createdAt: dispute.createdAt.toISOString(),
      updatedAt: dispute.updatedAt.toISOString(),
      terminalAt: dispute.terminalAt?.toISOString() ?? null,
    })),
    version: order.version,
    expiresAt: order.expiresAt.toISOString(),
    cancelledAt: order.cancelledAt?.toISOString() ?? null,
    expiredAt: order.expiredAt?.toISOString() ?? null,
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

function invalidSnapshot(): AppError {
  return new AppError('ORDER_SNAPSHOT_INVALID', 'ORDER_SNAPSHOT_INVALID', 500);
}
