import {
  CatalogEntityStatus,
  ListingDraftModel,
  ListingDraftServicePricingType,
  ListingDraftStatus,
  ProductImageStatus,
  ProductStatus,
  ProductVariantStatus,
  SellerProfileStatus,
} from '@prisma/client';
import { AppError } from '../common/errors/app-error';
import { decimalToMinorUnits } from './cart-pricing';

type Decimalish = { toString(): string } | string | null;
export type CartProduct = {
  id: string;
  slug: string;
  title: string;
  model: ListingDraftModel;
  status: ProductStatus;
  sellerProfileId: string;
  categoryId: string;
  subcategoryId: string | null;
  productType: unknown;
  price: Decimalish;
  stock: number | null;
  sellerProfile: { userId: string; status: SellerProfileStatus };
  sourceListingDraft: {
    status: ListingDraftStatus;
    categoryId: string | null;
    subcategoryId: string | null;
    productType: unknown;
  } | null;
  category: { status: CatalogEntityStatus } | null;
  subcategory: { status: CatalogEntityStatus; categoryId: string } | null;
  images: { status: ProductImageStatus; isCover: boolean }[];
  variants: {
    id: string;
    productId: string;
    title: string;
    status: ProductVariantStatus;
    price: Decimalish;
    stock: number | null;
  }[];
  serviceDetails: { pricingType: ListingDraftServicePricingType; basePrice: Decimalish } | null;
};
const domain = (code: string, status = 409): never => {
  throw new AppError(code, code, status, []);
};
const positivePrice = (v: Decimalish) => {
  if (v === null) return false;
  try {
    return decimalToMinorUnits(v) > 0n;
  } catch {
    return false;
  }
};
export function basePurchasable(p: CartProduct, sellerProfileId: string): boolean {
  return (
    p.status === ProductStatus.ACTIVE &&
    p.sellerProfileId === sellerProfileId &&
    p.sellerProfile.status === SellerProfileStatus.ACTIVE &&
    p.sourceListingDraft?.status === ListingDraftStatus.APPROVED &&
    p.category?.status === CatalogEntityStatus.ACTIVE &&
    (!p.subcategory ||
      (p.subcategory.status === CatalogEntityStatus.ACTIVE &&
        p.subcategory.categoryId === p.categoryId)) &&
    p.sourceListingDraft.categoryId === p.categoryId &&
    p.sourceListingDraft.subcategoryId === p.subcategoryId &&
    p.sourceListingDraft.productType === p.productType &&
    p.images.some((i) => i.status === ProductImageStatus.READY && i.isCover)
  );
}
export function assertCartSelection(
  p: CartProduct | null,
  input: {
    sellerProfileId: string;
    buyerUserId: string;
    productVariantId?: string;
    quantity: number;
  },
) {
  if (!p) domain('PRODUCT_NOT_PURCHASABLE', 422);
  const product = p as CartProduct;
  if (!basePurchasable(product, input.sellerProfileId)) domain('PRODUCT_NOT_PURCHASABLE', 422);
  if (product.sellerProfile.userId === input.buyerUserId) domain('SELF_PURCHASE_NOT_ALLOWED', 422);
  if (product.model === ListingDraftModel.NORMAL) {
    if (input.productVariantId) domain('PRODUCT_VARIANT_NOT_ALLOWED', 422);
    if (!positivePrice(product.price)) domain('PRODUCT_NOT_PURCHASABLE', 422);
    if (product.stock === null || product.stock < input.quantity) domain('INSUFFICIENT_STOCK', 409);
    return { variant: null, unitMinor: decimalToMinorUnits(product.price!) };
  }
  if (product.model === ListingDraftModel.DYNAMIC) {
    if (!input.productVariantId) domain('PRODUCT_VARIANT_REQUIRED', 422);
    const variant = product.variants.find(
      (v) => v.id === input.productVariantId && v.productId === product.id,
    );
    if (!variant || variant.status !== ProductVariantStatus.ACTIVE || !positivePrice(variant.price))
      domain('PRODUCT_VARIANT_NOT_AVAILABLE', 422);
    const selected = variant!;
    if (selected.stock === null || selected.stock < input.quantity)
      domain('INSUFFICIENT_STOCK', 409);
    return { variant: selected, unitMinor: decimalToMinorUnits(selected.price!) };
  }
  if (input.productVariantId) domain('PRODUCT_VARIANT_NOT_ALLOWED', 422);
  if (product.serviceDetails?.pricingType === ListingDraftServicePricingType.QUOTE)
    domain('PRODUCT_REQUIRES_QUOTE', 422);
  if (
    product.serviceDetails?.pricingType !== ListingDraftServicePricingType.FIXED ||
    !positivePrice(product.serviceDetails.basePrice)
  )
    domain('PRODUCT_NOT_PURCHASABLE', 422);
  if (input.quantity !== 1) domain('QUANTITY_UNAVAILABLE', 422);
  return { variant: null, unitMinor: decimalToMinorUnits(product.serviceDetails!.basePrice!) };
}
