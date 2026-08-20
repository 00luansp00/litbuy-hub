import { AppError } from '../common/errors/app-error';
import {
  CatalogEntityStatus,
  CatalogProductType,
  ListingDraftModel,
  ListingDraftServicePricingType,
  ListingDraftStatus,
  Prisma,
  ProductImageStatus,
  ProductStatus,
  ProductVariantStatus,
  SellerProfileStatus,
} from '@prisma/client';
import {
  assertCartSelection,
  basePurchasable,
  type CartProductCandidate,
} from './cart-purchasability';

const buyer = '10000000-0000-4000-8000-000000000001';
const seller = '20000000-0000-4000-8000-000000000001';
const product = (overrides: Partial<CartProductCandidate> = {}): CartProductCandidate => ({
  id: '30000000-0000-4000-8000-000000000001',
  sellerProfileId: seller,
  categoryId: 'cat',
  subcategoryId: null,
  productType: CatalogProductType.GAME,
  model: ListingDraftModel.NORMAL,
  status: ProductStatus.ACTIVE,
  slug: 'valid-product',
  title: 'Valid',
  description: 'Description',
  price: new Prisma.Decimal('49.90'),
  stock: 10,
  sellerProfile: {
    userId: '40000000-0000-4000-8000-000000000001',
    status: SellerProfileStatus.ACTIVE,
  },
  listingTier: 'SILVER',
  sourceListingDraft: {
    status: ListingDraftStatus.APPROVED,
    requestedPromotionTier: 'SILVER',
    categoryId: 'cat',
    subcategoryId: null,
    productType: CatalogProductType.GAME,
  },
  category: { status: CatalogEntityStatus.ACTIVE },
  subcategory: null,
  images: [{ status: ProductImageStatus.READY, isCover: true }],
  variants: [
    {
      id: '50000000-0000-4000-8000-000000000001',
      productId: '30000000-0000-4000-8000-000000000001',
      title: 'Canonical',
      status: ProductVariantStatus.ACTIVE,
      price: new Prisma.Decimal('49.90'),
      stock: 10,
    },
  ],
  serviceDetails: null,
  ...overrides,
});
const select = (
  candidate: CartProductCandidate,
  extra: Partial<Parameters<typeof assertCartSelection>[1]> = {},
) =>
  assertCartSelection(candidate, {
    sellerProfileId: seller,
    buyerUserId: buyer,
    quantity: 1,
    ...extra,
  });
const code = (fn: () => unknown) => {
  try {
    fn();
    return null;
  } catch (error) {
    return error instanceof AppError ? error.code : 'UNKNOWN';
  }
};

describe('cart purchasability', () => {
  it.each([ProductStatus.UNPUBLISHED, ProductStatus.PAUSED, ProductStatus.REMOVED])(
    'hides a non-active %s product behind PRODUCT_NOT_PURCHASABLE',
    (status) => {
      const candidate = product({ status });
      expect(basePurchasable(candidate, seller)).toBe(false);
      expect(code(() => select(candidate))).toBe('PRODUCT_NOT_PURCHASABLE');
    },
  );
  it('accepts a publicly eligible NORMAL selection', () =>
    expect(select(product()).unitMinor).toBe(4990n));
  it('rejects a NORMAL variant', () =>
    expect(
      code(() => select(product(), { productVariantId: '50000000-0000-4000-8000-000000000001' })),
    ).toBe('PRODUCT_VARIANT_NOT_ALLOWED'));
  it.each([
    ['empty title', { title: '' }],
    ['empty description', { description: '' }],
    ['invalid slug', { slug: 'Invalid Slug' }],
    ['missing cover', { images: [] }],
    [
      'two covers',
      {
        images: [
          { status: ProductImageStatus.READY, isCover: true },
          { status: ProductImageStatus.READY, isCover: true },
        ],
      },
    ],
    ['missing canonical variant', { variants: [] }],
    [
      'paused canonical variant',
      { variants: [{ ...product().variants[0], status: ProductVariantStatus.PAUSED }] },
    ],
    [
      'seller inactive',
      { sellerProfile: { ...product().sellerProfile, status: SellerProfileStatus.SUSPENDED } },
    ],
    [
      'origin invalid',
      {
        listingTier: 'SILVER',
        sourceListingDraft: {
          ...product().sourceListingDraft!,
          status: ListingDraftStatus.REJECTED,
        },
      },
    ],
    ['category inactive', { category: { status: CatalogEntityStatus.INACTIVE } }],
    ['taxonomy mismatch', { categoryId: 'different' }],
  ] satisfies [string, Partial<CartProductCandidate>][])(
    'hides publicly ineligible NORMAL: %s',
    (_name, patch) => {
      expect(basePurchasable(product(patch), seller)).toBe(false);
      expect(code(() => select(product(patch)))).toBe('PRODUCT_NOT_PURCHASABLE');
    },
  );
  it('requires a variant for DYNAMIC', () =>
    expect(code(() => select(product({ model: ListingDraftModel.DYNAMIC, price: null })))).toBe(
      'PRODUCT_VARIANT_REQUIRED',
    ));
  it('rejects wrong and paused DYNAMIC variants', () => {
    const dynamic = product({ model: ListingDraftModel.DYNAMIC, price: null });
    expect(
      code(() => select(dynamic, { productVariantId: '90000000-0000-4000-8000-000000000001' })),
    ).toBe('PRODUCT_VARIANT_NOT_AVAILABLE');
    expect(
      code(() =>
        select(
          product({
            ...dynamic,
            variants: [{ ...dynamic.variants[0], status: ProductVariantStatus.PAUSED }],
          }),
          { productVariantId: dynamic.variants[0].id },
        ),
      ),
    ).toBe('PRODUCT_NOT_PURCHASABLE');
  });
  it('accepts FIXED one and rejects quantity/QUOTE', () => {
    const fixed = product({
      model: ListingDraftModel.SERVICE,
      price: null,
      stock: null,
      variants: [{ ...product().variants[0], price: new Prisma.Decimal('20'), stock: 0 }],
      serviceDetails: {
        pricingType: ListingDraftServicePricingType.FIXED,
        basePrice: new Prisma.Decimal('20'),
      },
    });
    expect(select(fixed).unitMinor).toBe(2000n);
    expect(code(() => select(fixed, { quantity: 2 }))).toBe('QUANTITY_UNAVAILABLE');
    const quote = product({
      ...fixed,
      variants: [],
      serviceDetails: { pricingType: ListingDraftServicePricingType.QUOTE, basePrice: null },
    });
    expect(code(() => select(quote))).toBe('PRODUCT_REQUIRES_QUOTE');
  });
  it('blocks self purchase, seller mismatch and insufficient stock', () => {
    expect(
      code(() => select(product({ sellerProfile: { ...product().sellerProfile, userId: buyer } }))),
    ).toBe('SELF_PURCHASE_NOT_ALLOWED');
    expect(
      code(() =>
        assertCartSelection(product(), {
          sellerProfileId: 'other',
          buyerUserId: buyer,
          quantity: 1,
        }),
      ),
    ).toBe('PRODUCT_NOT_PURCHASABLE');
    expect(code(() => select(product(), { quantity: 11 }))).toBe('INSUFFICIENT_STOCK');
  });
});
