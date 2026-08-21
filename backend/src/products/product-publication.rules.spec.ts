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
import { ProductLifecycleAction } from './dto';
import {
  assertPublicationEligible,
  lifecycleTarget,
  publicationEligibilityCode,
  type PublicationCandidate,
} from './product-publication.rules';

const candidate = (): PublicationCandidate => ({
  status: ProductStatus.UNPUBLISHED,
  slug: 'produto-real',
  title: 'Produto real',
  description: 'Descrição real',
  price: '10.00',
  stock: 0,
  model: ListingDraftModel.NORMAL,
  sellerProfile: { status: SellerProfileStatus.ACTIVE },
  listingTier: 'SILVER',
  sellerPlan: 'STANDARD',
  sourceListingDraft: {
    status: ListingDraftStatus.APPROVED,
    requestedPromotionTier: 'SILVER',
    requestedSellerPlan: 'STANDARD',
    categoryId: 'category',
    subcategoryId: null,
    productType: 'ACCOUNT',
  },
  category: { status: CatalogEntityStatus.ACTIVE },
  categoryId: 'category',
  subcategoryId: null,
  productType: 'ACCOUNT',
  subcategory: null,
  images: [{ status: ProductImageStatus.READY, isCover: true }],
  variants: [{ status: ProductVariantStatus.ACTIVE, price: '10.00', stock: 0 }],
  serviceDetails: null,
});
const code = (fn: () => unknown, expected: string) => {
  try {
    fn();
    throw new Error('did not throw');
  } catch (error) {
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe(expected);
  }
};

describe('product lifecycle state machine', () => {
  test.each([
    [ProductStatus.UNPUBLISHED, ProductLifecycleAction.ACTIVATE, ProductStatus.ACTIVE],
    [ProductStatus.ACTIVE, ProductLifecycleAction.PAUSE, ProductStatus.PAUSED],
    [ProductStatus.PAUSED, ProductLifecycleAction.RESUME, ProductStatus.ACTIVE],
    [ProductStatus.UNPUBLISHED, ProductLifecycleAction.REMOVE, ProductStatus.REMOVED],
    [ProductStatus.ACTIVE, ProductLifecycleAction.REMOVE, ProductStatus.REMOVED],
    [ProductStatus.PAUSED, ProductLifecycleAction.REMOVE, ProductStatus.REMOVED],
  ])('%s + %s -> %s', (current, action, target) => {
    expect(lifecycleTarget(current, action)).toEqual({ status: target, changed: true });
  });
  it('makes completed retries idempotent', () => {
    expect(lifecycleTarget(ProductStatus.ACTIVE, ProductLifecycleAction.ACTIVATE).changed).toBe(
      false,
    );
    expect(lifecycleTarget(ProductStatus.ACTIVE, ProductLifecycleAction.RESUME).changed).toBe(
      false,
    );
    expect(lifecycleTarget(ProductStatus.PAUSED, ProductLifecycleAction.PAUSE).changed).toBe(false);
    expect(lifecycleTarget(ProductStatus.REMOVED, ProductLifecycleAction.REMOVE).changed).toBe(
      false,
    );
  });
  it('keeps REMOVED terminal and rejects other invalid transitions', () => {
    code(
      () => lifecycleTarget(ProductStatus.REMOVED, ProductLifecycleAction.ACTIVATE),
      'PRODUCT_REMOVED_TERMINAL',
    );
    code(
      () => lifecycleTarget(ProductStatus.UNPUBLISHED, ProductLifecycleAction.PAUSE),
      'PRODUCT_STATUS_TRANSITION_INVALID',
    );
  });
});

describe('product publication eligibility', () => {
  it('shares the non-throwing evaluation with the lifecycle assertion', () => {
    const valid = candidate();
    expect(publicationEligibilityCode(valid)).toBeNull();
    valid.images = [];
    expect(publicationEligibilityCode(valid)).toBe('PRODUCT_READY_COVER_REQUIRED');
    code(() => assertPublicationEligible(valid), 'PRODUCT_READY_COVER_REQUIRED');
  });
  it('accepts NORMAL with zero stock', () =>
    expect(() => assertPublicationEligible(candidate())).not.toThrow());
  test.each([
    ['sellerProfile.status', SellerProfileStatus.SUSPENDED, 'SELLER_PROFILE_ACTIVE_REQUIRED'],
    ['sourceListingDraft.status', ListingDraftStatus.REJECTED, 'PRODUCT_SOURCE_NOT_APPROVED'],
    ['category.status', CatalogEntityStatus.INACTIVE, 'PRODUCT_TAXONOMY_INACTIVE'],
  ])('rejects %s', (path, value, expected) => {
    const p = candidate();
    const [object] = path.split('.') as ['sellerProfile' | 'sourceListingDraft' | 'category'];
    (p[object] as { status: unknown }).status = value;
    code(() => assertPublicationEligible(p), expected);
  });
  it('rejects inactive or mismatched subcategory', () => {
    const p = candidate();
    p.subcategory = { status: CatalogEntityStatus.INACTIVE, categoryId: p.categoryId };
    code(() => assertPublicationEligible(p), 'PRODUCT_TAXONOMY_INACTIVE');
    p.subcategory = { status: CatalogEntityStatus.ACTIVE, categoryId: 'other' };
    code(() => assertPublicationEligible(p), 'PRODUCT_TAXONOMY_INACTIVE');
  });
  it.each(['categoryId', 'subcategoryId', 'productType'] as const)(
    'rejects source taxonomy mismatch in %s',
    (field) => {
      const p = candidate();
      if (field === 'categoryId') p.sourceListingDraft!.categoryId = 'other';
      if (field === 'subcategoryId') p.sourceListingDraft!.subcategoryId = 'other';
      if (field === 'productType') p.sourceListingDraft!.productType = 'GAME';
      code(() => assertPublicationEligible(p), 'PRODUCT_TAXONOMY_MISMATCH');
    },
  );
  it('requires a READY cover and ignores pending uploads', () => {
    const p = candidate();
    p.images = [{ status: ProductImageStatus.PENDING_UPLOAD, isCover: true }];
    code(() => assertPublicationEligible(p), 'PRODUCT_READY_COVER_REQUIRED');
    p.images = [{ status: ProductImageStatus.READY, isCover: false }];
    code(() => assertPublicationEligible(p), 'PRODUCT_READY_COVER_REQUIRED');
  });
  it('defensively rejects an in-memory aggregate with two READY covers', () => {
    const p = candidate();
    p.images.push({ status: ProductImageStatus.READY, isCover: true });
    expect(publicationEligibilityCode(p)).toBe('PRODUCT_READY_COVER_REQUIRED');
  });
  it('rejects incomplete content and invalid NORMAL data', () => {
    const p = candidate();
    p.title = ' ';
    code(() => assertPublicationEligible(p), 'PRODUCT_DATA_INCOMPLETE');
    const q = candidate();
    q.price = '0';
    code(() => assertPublicationEligible(q), 'PRODUCT_VARIANT_INVALID');
  });
  it('rejects a paused NORMAL variant', () => {
    const p = candidate();
    p.variants[0].status = ProductVariantStatus.PAUSED;
    code(() => assertPublicationEligible(p), 'PRODUCT_VARIANT_INVALID');
  });
  it('requires an active, valid DYNAMIC variant', () => {
    const p = candidate();
    p.model = ListingDraftModel.DYNAMIC;
    p.price = null;
    p.stock = null;
    p.variants = [{ status: ProductVariantStatus.PAUSED, price: '10', stock: 0 }];
    code(() => assertPublicationEligible(p), 'PRODUCT_VARIANT_INVALID');
  });
  it('validates FIXED services and accepts QUOTE without fake price or variant', () => {
    const fixed = candidate();
    fixed.model = ListingDraftModel.SERVICE;
    fixed.price = null;
    fixed.stock = null;
    fixed.serviceDetails = { pricingType: ListingDraftServicePricingType.FIXED, basePrice: null };
    code(() => assertPublicationEligible(fixed), 'PRODUCT_SERVICE_DETAILS_INVALID');
    fixed.serviceDetails = { pricingType: ListingDraftServicePricingType.FIXED, basePrice: '10' };
    fixed.variants[0].status = ProductVariantStatus.PAUSED;
    code(() => assertPublicationEligible(fixed), 'PRODUCT_SERVICE_DETAILS_INVALID');
    const quote = candidate();
    quote.model = ListingDraftModel.SERVICE;
    quote.price = null;
    quote.stock = null;
    quote.variants = [];
    quote.serviceDetails = { pricingType: ListingDraftServicePricingType.QUOTE, basePrice: null };
    expect(() => assertPublicationEligible(quote)).not.toThrow();
  });
});
