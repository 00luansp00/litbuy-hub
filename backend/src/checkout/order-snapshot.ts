import type { CartProductPayload } from '../carts/carts.service';
export function orderItemSnapshot(
  product: CartProductPayload,
  variant: { id: string; title: string } | null,
  seller: { id: string; slug: string; storeName: string },
  unit: bigint,
  quantity: number,
) {
  return {
    sourceProductId: product.id,
    sourceProductVersion: product.version,
    sourceProductVariantId: variant?.id ?? null,
    sellerProfileId: seller.id,
    sellerStoreName: seller.storeName,
    sellerSlug: seller.slug,
    productSlug: product.slug,
    productTitle: product.title,
    variantTitle: variant?.title ?? null,
    productType: product.productType,
    productModel: product.model,
    deliveryMode: product.deliveryMode,
    unitAmountMinor: unit,
    quantity,
    lineTotalAmountMinor: unit * BigInt(quantity),
    currency: 'BRL',
    serviceEstimatedDelivery: product.serviceDetails?.estimatedDelivery ?? null,
    serviceBuyerRequirements: product.serviceDetails?.buyerRequirements ?? null,
    pricingPolicyVersion: 1,
  };
}
