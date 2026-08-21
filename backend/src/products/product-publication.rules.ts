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
import type {
  CatalogProductType,
  ListingDraftPromotionPreference,
  ListingDraftSellerPlanPreference,
} from '@prisma/client';
import { AppError } from '../common/errors/app-error';
import { ProductLifecycleAction } from './dto';

type Decimalish = { toString(): string } | number | string | null;
export type PublicationCandidate = {
  status: ProductStatus;
  slug: string;
  title: string;
  description: string;
  price: Decimalish;
  stock: number | null;
  model: ListingDraftModel;
  listingTier: ListingDraftPromotionPreference;
  sellerPlan: ListingDraftSellerPlanPreference;
  sellerProfile: { status: SellerProfileStatus };
  sourceListingDraft: {
    status: ListingDraftStatus;
    categoryId: string | null;
    subcategoryId: string | null;
    productType: CatalogProductType | null;
    requestedPromotionTier: ListingDraftPromotionPreference | null;
    requestedSellerPlan: ListingDraftSellerPlanPreference;
  } | null;
  category: { status: CatalogEntityStatus } | null;
  subcategory: { status: CatalogEntityStatus; categoryId: string } | null;
  categoryId: string;
  subcategoryId: string | null;
  productType: CatalogProductType;
  images: { status: ProductImageStatus; isCover: boolean }[];
  variants: { status: ProductVariantStatus; price: Decimalish; stock: number | null }[];
  serviceDetails: { pricingType: ListingDraftServicePricingType; basePrice: Decimalish } | null;
};
const fail = (code: string): never => {
  throw new AppError(code, code, 409, []);
};
const positive = (value: Decimalish) => value !== null && Number(value.toString()) > 0;
const stockValid = (value: number | null) =>
  value === null || (Number.isInteger(value) && value >= 0);

export function lifecycleTarget(status: ProductStatus, action: ProductLifecycleAction) {
  if (
    (action === ProductLifecycleAction.ACTIVATE && status === ProductStatus.ACTIVE) ||
    (action === ProductLifecycleAction.RESUME && status === ProductStatus.ACTIVE) ||
    (action === ProductLifecycleAction.PAUSE && status === ProductStatus.PAUSED) ||
    (action === ProductLifecycleAction.REMOVE && status === ProductStatus.REMOVED)
  )
    return { status, changed: false };
  if (status === ProductStatus.REMOVED) fail('PRODUCT_REMOVED_TERMINAL');
  if (action === ProductLifecycleAction.ACTIVATE && status === ProductStatus.UNPUBLISHED)
    return { status: ProductStatus.ACTIVE, changed: true };
  if (action === ProductLifecycleAction.PAUSE && status === ProductStatus.ACTIVE)
    return { status: ProductStatus.PAUSED, changed: true };
  if (action === ProductLifecycleAction.RESUME && status === ProductStatus.PAUSED)
    return { status: ProductStatus.ACTIVE, changed: true };
  if (action === ProductLifecycleAction.REMOVE)
    return { status: ProductStatus.REMOVED, changed: true };
  return fail('PRODUCT_STATUS_TRANSITION_INVALID');
}

export function publicationEligibilityCode(p: PublicationCandidate): string | null {
  if (p.sellerProfile.status !== SellerProfileStatus.ACTIVE)
    return 'SELLER_PROFILE_ACTIVE_REQUIRED';
  if (!p.sourceListingDraft || p.sourceListingDraft.status !== ListingDraftStatus.APPROVED)
    return 'PRODUCT_SOURCE_NOT_APPROVED';
  if (
    !p.sourceListingDraft.requestedPromotionTier ||
    p.listingTier !== p.sourceListingDraft.requestedPromotionTier
  )
    return 'PRODUCT_LISTING_TIER_MISMATCH';
  if (p.sellerPlan !== p.sourceListingDraft.requestedSellerPlan)
    return 'PRODUCT_SELLER_PLAN_MISMATCH';
  if (
    p.categoryId !== p.sourceListingDraft.categoryId ||
    p.subcategoryId !== p.sourceListingDraft.subcategoryId ||
    p.productType !== p.sourceListingDraft.productType
  )
    return 'PRODUCT_TAXONOMY_MISMATCH';
  if (
    !p.category ||
    p.category.status !== CatalogEntityStatus.ACTIVE ||
    (p.subcategory &&
      (p.subcategory.status !== CatalogEntityStatus.ACTIVE ||
        p.subcategory.categoryId !== p.categoryId))
  )
    return 'PRODUCT_TAXONOMY_INACTIVE';
  if (!p.title.trim() || !p.description.trim() || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.slug))
    return 'PRODUCT_DATA_INCOMPLETE';
  const ready = p.images.filter((image) => image.status === ProductImageStatus.READY);
  if (!ready.length || ready.filter((image) => image.isCover).length !== 1)
    return 'PRODUCT_READY_COVER_REQUIRED';
  if (p.model === ListingDraftModel.NORMAL) {
    if (!positive(p.price) || !stockValid(p.stock) || p.stock === null || p.variants.length !== 1)
      return 'PRODUCT_VARIANT_INVALID';
    const variant = p.variants[0];
    if (
      variant.status !== ProductVariantStatus.ACTIVE ||
      !positive(variant.price) ||
      !stockValid(variant.stock) ||
      variant.stock === null
    )
      return 'PRODUCT_VARIANT_INVALID';
  } else if (p.model === ListingDraftModel.DYNAMIC) {
    if (
      !p.variants.length ||
      !p.variants.some((variant) => variant.status === ProductVariantStatus.ACTIVE) ||
      p.variants.some((variant) => !positive(variant.price) || !stockValid(variant.stock))
    )
      return 'PRODUCT_VARIANT_INVALID';
  } else {
    const details = p.serviceDetails;
    if (!details) return 'PRODUCT_SERVICE_DETAILS_INVALID';
    if (details.pricingType === ListingDraftServicePricingType.FIXED) {
      if (
        !positive(details.basePrice) ||
        p.variants.length !== 1 ||
        p.variants[0].status !== ProductVariantStatus.ACTIVE ||
        !positive(p.variants[0].price)
      )
        return 'PRODUCT_SERVICE_DETAILS_INVALID';
    } else if (
      details.pricingType !== ListingDraftServicePricingType.QUOTE ||
      details.basePrice !== null ||
      p.variants.length !== 0
    )
      return 'PRODUCT_SERVICE_DETAILS_INVALID';
  }
  return null;
}

export function assertPublicationEligible(p: PublicationCandidate) {
  const code = publicationEligibilityCode(p);
  if (code) fail(code);
}
