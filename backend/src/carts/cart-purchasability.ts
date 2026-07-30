import {
  ListingDraftModel,
  ListingDraftServicePricingType,
  ProductVariantStatus,
} from '@prisma/client';
import type { PublicationCandidate } from '../products/product-publication.rules';
import { publicationEligibilityCode } from '../products/product-publication.rules';
import { AppError } from '../common/errors/app-error';
import { decimalToMinorUnits } from './cart-pricing';

type CartVariant = PublicationCandidate['variants'][number] & {
  id: string;
  productId: string;
  title: string;
};
export type CartProductCandidate = Omit<PublicationCandidate, 'sellerProfile' | 'variants'> & {
  id: string;
  sellerProfileId: string;
  sellerProfile: PublicationCandidate['sellerProfile'] & { userId: string };
  variants: CartVariant[];
};
type SelectionInput = {
  sellerProfileId: string;
  buyerUserId: string;
  productVariantId?: string;
  quantity: number;
};
export type CartSelection = { variant: CartVariant | null; unitMinor: bigint };

const domain = (code: string, status: number): never => {
  throw new AppError(code, code, status, []);
};
const money = (value: { toString(): string } | string | number | null): bigint | null => {
  if (value === null) return null;
  try {
    const result = decimalToMinorUnits(value);
    return result > 0n ? result : null;
  } catch {
    return null;
  }
};
export function basePurchasable(product: CartProductCandidate, sellerProfileId: string): boolean {
  return (
    product.sellerProfileId === sellerProfileId && publicationEligibilityCode(product) === null
  );
}
export function assertCartSelection(
  product: CartProductCandidate | null,
  input: SelectionInput,
): CartSelection {
  if (!product) throw new AppError('PRODUCT_NOT_PURCHASABLE', 'PRODUCT_NOT_PURCHASABLE', 422, []);
  if (!basePurchasable(product, input.sellerProfileId)) domain('PRODUCT_NOT_PURCHASABLE', 422);
  if (product.sellerProfile.userId === input.buyerUserId) domain('SELF_PURCHASE_NOT_ALLOWED', 422);
  if (product.model === ListingDraftModel.NORMAL) {
    if (input.productVariantId) domain('PRODUCT_VARIANT_NOT_ALLOWED', 422);
    const unitMinor = money(product.price);
    if (unitMinor === null)
      throw new AppError('PRODUCT_NOT_PURCHASABLE', 'PRODUCT_NOT_PURCHASABLE', 422, []);
    if (product.stock === null || product.stock < input.quantity) domain('INSUFFICIENT_STOCK', 409);
    return { variant: null, unitMinor };
  }
  if (product.model === ListingDraftModel.DYNAMIC) {
    if (!input.productVariantId) domain('PRODUCT_VARIANT_REQUIRED', 422);
    const variant = product.variants.find(
      ({ id, productId }) => id === input.productVariantId && productId === product.id,
    );
    if (!variant || variant.status !== ProductVariantStatus.ACTIVE)
      throw new AppError('PRODUCT_VARIANT_NOT_AVAILABLE', 'PRODUCT_VARIANT_NOT_AVAILABLE', 422, []);
    const unitMinor = money(variant.price);
    if (unitMinor === null)
      throw new AppError('PRODUCT_VARIANT_NOT_AVAILABLE', 'PRODUCT_VARIANT_NOT_AVAILABLE', 422, []);
    if (variant.stock === null || variant.stock < input.quantity) domain('INSUFFICIENT_STOCK', 409);
    return { variant, unitMinor };
  }
  if (input.productVariantId) domain('PRODUCT_VARIANT_NOT_ALLOWED', 422);
  const serviceDetails = product.serviceDetails;
  if (serviceDetails?.pricingType === ListingDraftServicePricingType.QUOTE)
    domain('PRODUCT_REQUIRES_QUOTE', 422);
  if (serviceDetails?.pricingType !== ListingDraftServicePricingType.FIXED)
    throw new AppError('PRODUCT_NOT_PURCHASABLE', 'PRODUCT_NOT_PURCHASABLE', 422, []);
  const unitMinor = money(serviceDetails.basePrice);
  if (unitMinor === null)
    throw new AppError('PRODUCT_NOT_PURCHASABLE', 'PRODUCT_NOT_PURCHASABLE', 422, []);
  if (input.quantity !== 1) domain('QUANTITY_UNAVAILABLE', 422);
  return { variant: null, unitMinor };
}
