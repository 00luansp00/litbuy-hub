import {
  CatalogEntityStatus,
  CatalogProductType,
  CartStatus,
  ListingDraftDeliveryMode,
  ListingDraftModel,
  ListingDraftStatus,
  Prisma,
  ProductImageStatus,
  ProductStatus,
  ProductVariantStatus,
  SellerProfileStatus,
} from '@prisma/client';
import type { PrismaService } from '../database/prisma.service';
import { CartsService, type CartResponsePayload } from './carts.service';

const now = new Date('2026-07-30T00:00:00.000Z');
const product = (sellerUserId = 'seller-user') => ({
  id: 'product',
  sourceListingDraftId: 'draft',
  sellerProfileId: 'seller',
  categoryId: 'cat',
  subcategoryId: null,
  productType: CatalogProductType.GAME,
  model: ListingDraftModel.NORMAL,
  status: ProductStatus.ACTIVE,
  pauseReason: null,
  slug: 'valid-product',
  title: 'Valid',
  description: 'Description',
  price: new Prisma.Decimal('49.90'),
  stock: 10,
  deliveryMode: ListingDraftDeliveryMode.MANUAL,
  autoMessage: 'private',
  version: 1,
  createdAt: now,
  updatedAt: now,
  sellerProfile: { userId: sellerUserId, status: SellerProfileStatus.ACTIVE },
  listingTier: 'SILVER' as const,
  sellerPlan: 'STANDARD' as const,
  sourceListingDraft: {
    status: ListingDraftStatus.APPROVED,
    requestedPromotionTier: 'SILVER' as const,
    requestedSellerPlan: 'STANDARD' as const,
    categoryId: 'cat',
    subcategoryId: null,
    productType: CatalogProductType.GAME,
  },
  category: { status: CatalogEntityStatus.ACTIVE },
  subcategory: null,
  images: [{ status: ProductImageStatus.READY, isCover: true }],
  variants: [
    {
      id: 'variant',
      productId: 'product',
      title: 'Canonical',
      status: ProductVariantStatus.ACTIVE,
      price: new Prisma.Decimal('49.90'),
      stock: 10,
    },
  ],
  serviceDetails: null,
});
const cart = (items: CartResponsePayload['items'], buyerUserId = 'buyer'): CartResponsePayload => ({
  id: 'cart',
  buyerUserId,
  sellerProfileId: 'seller',
  status: CartStatus.ACTIVE,
  version: 3,
  createdAt: now,
  updatedAt: now,
  sellerProfile: { id: 'seller', slug: 'store', storeName: 'Store' },
  items,
});
const item = (sellerUserId = 'seller-user'): CartResponsePayload['items'][number] => ({
  id: 'item',
  cartId: 'cart',
  productId: 'product',
  productVariantId: null,
  quantity: 2,
  createdAt: now,
  updatedAt: now,
  product: product(sellerUserId),
  variant: null,
});
const setup = (value: CartResponsePayload[]) => {
  const findMany = jest.fn().mockResolvedValue(value);
  const prisma = { cart: { findMany } } as unknown as PrismaService;
  const listingTierPolicy = {
    buyerVipOptions: jest.fn((amountMinor: bigint) =>
      Promise.resolve(
        (
          [
            ['NONE', 0],
            ['BASIC', 299],
            ['PREMIUM', 499],
          ] as const
        ).map(([plan, percentBps]) => ({
          plan,
          policyId: 'policy',
          pricingPolicyVersion: 1,
          ruleId: plan === 'NONE' ? null : `rule-${plan}`,
          percentBps,
          baseAmountMinor: amountMinor,
          feeAmountMinor: (amountMinor * BigInt(percentBps)) / 10_000n,
          totalAmountMinor: amountMinor + (amountMinor * BigInt(percentBps)) / 10_000n,
        })),
      ),
    ),
  };
  return {
    service: new CartsService(prisma, listingTierPolicy as never),
    findMany,
  };
};

describe('CartsService reconciliation', () => {
  it('returns a complete subtotal without private catalog fields and performs no mutation', async () => {
    const { service, findMany } = setup([cart([item()])]);
    const result = await service.list('buyer', { page: 1, limit: 20 });
    expect(result.items[0]).toMatchObject({
      version: 3,
      previewSubtotalMinor: '9980',
      checkoutReady: true,
    });
    const serialized = JSON.stringify(result);
    for (const field of [
      'objectKey',
      'accountDetails',
      'recoveryLevel',
      'recoveryRisk',
      'warrantyNote',
      'buyerRequirements',
      'notes',
      'autoMessage',
    ])
      expect(serialized).not.toContain(field);
    expect(findMany).toHaveBeenCalledTimes(1);
  });
  it('reconciles self-purchase generically without changing the cart', async () => {
    const stored = cart([item('buyer')]);
    const { service } = setup([stored]);
    const result = await service.list('buyer', { page: 1, limit: 20 });
    expect(result.items[0]).toMatchObject({
      version: 3,
      previewSubtotalMinor: null,
      checkoutReady: false,
      items: [{ purchasable: false, issues: ['PRODUCT_UNAVAILABLE'] }],
    });
    expect(stored.version).toBe(3);
    expect(stored.items).toHaveLength(1);
    expect(stored.items[0].quantity).toBe(2);
  });
  it('keeps an empty active cart with null subtotal', async () => {
    const { service } = setup([cart([])]);
    const result = await service.list('buyer', { page: 1, limit: 20 });
    expect(result.items[0]).toMatchObject({
      status: CartStatus.ACTIVE,
      items: [],
      previewSubtotalMinor: null,
      checkoutReady: false,
    });
  });
});
