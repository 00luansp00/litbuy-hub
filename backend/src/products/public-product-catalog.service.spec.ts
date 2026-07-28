import {
  ListingDraftModel,
  ListingDraftServicePricingType,
  Prisma,
  ProductVariantStatus,
} from '@prisma/client';
import type { PrismaService } from '../database/prisma.service';
import type { ProductImageStorage } from '../product-images/product-image.storage';
import {
  publicOrderBy,
  publicPricing,
  publicStock,
  PublicProductCatalogService,
  shortDescription,
} from './public-product-catalog.service';
import { PublicCatalogSort } from './public-product-catalog.dto';

type PricingInput = Parameters<typeof publicPricing>[0];
const product = (value: Record<string, unknown>): PricingInput =>
  ({
    variants: [],
    serviceDetails: null,
    price: null,
    stock: null,
    ...value,
  }) as unknown as PricingInput;

describe('public product mapping helpers', () => {
  it('normalizes and deterministically truncates descriptions', () => {
    expect(shortDescription('  one\n\t two  ')).toBe('one two');
    expect(shortDescription('x'.repeat(170))).toHaveLength(160);
  });

  it('maps NORMAL pricing and stock without converting money to number', () => {
    const input = product({
      model: ListingDraftModel.NORMAL,
      price: new Prisma.Decimal('10'),
      stock: 3,
    });
    expect(publicPricing(input)).toEqual({ kind: 'FIXED', amount: '10.00' });
    expect(publicStock(input)).toBe(3);
  });

  it('maps DYNAMIC to the lowest active price and safe aggregate stock', () => {
    const input = product({
      model: ListingDraftModel.DYNAMIC,
      variants: [
        { status: ProductVariantStatus.ACTIVE, price: new Prisma.Decimal('12.20'), stock: 2 },
        { status: ProductVariantStatus.ACTIVE, price: new Prisma.Decimal('9.10'), stock: 3 },
      ],
    });
    expect(publicPricing(input)).toEqual({ kind: 'FROM', amount: '9.10' });
    expect(publicStock(input)).toBe(5);
  });

  it.each([
    [
      ListingDraftServicePricingType.FIXED,
      new Prisma.Decimal('25'),
      { kind: 'FIXED', amount: '25.00' },
    ],
    [ListingDraftServicePricingType.QUOTE, null, { kind: 'QUOTE', amount: null }],
  ])('maps SERVICE/%s pricing', (pricingType, basePrice, expected) => {
    const input = product({
      model: ListingDraftModel.SERVICE,
      serviceDetails: { pricingType, basePrice },
    });
    expect(publicPricing(input)).toEqual(expected);
    expect(publicStock(input)).toBeNull();
  });

  it.each([
    [PublicCatalogSort.RECENT, [{ updatedAt: 'desc' }, { id: 'desc' }]],
    [PublicCatalogSort.OLDEST, [{ updatedAt: 'asc' }, { id: 'asc' }]],
    [PublicCatalogSort.TITLE_ASC, [{ title: 'asc' }, { id: 'asc' }]],
    [PublicCatalogSort.TITLE_DESC, [{ title: 'desc' }, { id: 'desc' }]],
  ])('uses a deterministic id tie-breaker for %s', (sort, expected) => {
    expect(publicOrderBy(sort)).toEqual(expected);
  });
});

const candidate = (id: string, eligible = true) => ({
  id,
  sourceListingDraftId: `draft-${id}`,
  sellerProfileId: `seller-${id}`,
  categoryId: 'category',
  subcategoryId: null,
  productType: 'ACCOUNT' as const,
  model: ListingDraftModel.NORMAL,
  status: 'ACTIVE' as const,
  slug: `product-${id}`,
  title: `Product ${id}`,
  description: '  Public   description ',
  price: new Prisma.Decimal('19.90'),
  stock: 4,
  deliveryMode: 'MANUAL' as const,
  autoMessage: 'private',
  version: 2,
  createdAt: new Date(),
  updatedAt: new Date(),
  sellerProfile: {
    id: `seller-${id}`,
    userId: `user-${id}`,
    storeName: 'Store',
    slug: 'store',
    description: null,
    status: 'ACTIVE' as const,
    verified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  sourceListingDraft: {
    id: `draft-${id}`,
    sellerProfileId: `seller-${id}`,
    categoryId: 'category',
    subcategoryId: null,
    productType: 'ACCOUNT' as const,
    model: ListingDraftModel.NORMAL,
    status: 'APPROVED' as const,
    title: 'Draft',
    description: 'Draft',
    price: null,
    stock: null,
    deliveryMode: 'MANUAL' as const,
    requestedPromotionTier: 'SILVER' as const,
    requestedSellerPlan: 'STANDARD' as const,
    autoMessage: null,
    notifyInApp: true,
    notifyBrowser: false,
    notifyEmailFuture: false,
    notifyExternalFuture: false,
    wizardStep: 1,
    version: 1,
    submittedAt: null,
    reviewStartedAt: null,
    reviewedAt: null,
    reviewedByUserId: null,
    rejectionCode: null,
    rejectionReason: null,
    approvedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  category: {
    id: 'category',
    slug: 'category',
    name: 'Category',
    description: null,
    iconKey: null,
    colorHex: null,
    sortOrder: 0,
    featured: false,
    status: 'ACTIVE' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  subcategory: null,
  variants: [
    {
      id: `variant-${id}`,
      productId: id,
      title: 'Variant',
      description: null,
      price: new Prisma.Decimal('19.90'),
      stock: 4,
      status: ProductVariantStatus.ACTIVE,
      sortOrder: 0,
    },
  ],
  images: eligible
    ? [
        {
          id: `image-${id}`,
          productId: id,
          objectKey: `private/${id}.png`,
          status: 'READY' as const,
          contentType: 'image/png',
          sizeBytes: 10,
          altText: 'Cover',
          sortOrder: 0,
          isCover: true,
          uploadedAt: new Date(),
          uploadExpiresAt: new Date(),
          deletedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]
    : [],
  serviceDetails: null,
});

describe('PublicProductCatalogService', () => {
  const findMany = jest.fn();
  const findFirst = jest.fn();
  const prisma = { product: { findMany, findFirst } } as unknown as PrismaService;
  const storage = {
    createReadUrl: jest.fn(),
    createUploadUrl: jest.fn(),
    headObject: jest.fn(),
    deleteObject: jest.fn(),
  } satisfies jest.Mocked<ProductImageStorage>;
  const service = new PublicProductCatalogService(prisma, storage);

  beforeEach(() => {
    jest.resetAllMocks();
    storage.createReadUrl.mockImplementation((key) =>
      Promise.resolve({
        readUrl: `https://images.test/${key}`,
        expiresAt: new Date('2030-01-01T00:00:00.000Z'),
      }),
    );
  });

  it('paginates after eligibility, computes hasNext, forwards filters, and signs selected cards only', async () => {
    findMany.mockResolvedValueOnce([
      candidate('1'),
      candidate('hidden', false),
      candidate('2'),
      candidate('3'),
    ]);
    const response = await service.list({
      categorySlug: 'category',
      subcategorySlug: 'subcategory',
      productType: 'ACCOUNT',
      page: 2,
      limit: 1,
      sort: PublicCatalogSort.RECENT,
    });
    expect(response.items.map((item) => item.id)).toEqual(['2']);
    expect(response.pagination).toEqual({ page: 2, limit: 1, hasNext: true });
    expect(storage.createReadUrl).toHaveBeenCalledTimes(1);
    expect(storage.createReadUrl).toHaveBeenCalledWith('private/2.png');
    const calls = findMany.mock.calls as unknown as Array<
      [
        {
          where: {
            productType: string;
            category: { slug: string };
            subcategory: { slug: string };
          };
        },
      ]
    >;
    const query = calls[0][0];
    expect(query.where.productType).toBe('ACCOUNT');
    expect(query.where.category.slug).toBe('category');
    expect(query.where.subcategory.slug).toBe('subcategory');
  });

  it('maps a detail explicitly and signs each READY image once', async () => {
    findFirst.mockResolvedValueOnce(candidate('detail'));
    const response = await service.detail('product-detail');
    expect(response).toMatchObject({
      id: 'detail',
      slug: 'product-detail',
      shortDescription: 'Public description',
      pricing: { kind: 'FIXED', amount: '19.90' },
      coverImage: { altText: 'Cover' },
      variants: [{ id: 'variant-detail', price: '19.90' }],
      gallery: [{ id: 'image-detail', isCover: true }],
    });
    expect(storage.createReadUrl).toHaveBeenCalledTimes(1);
    const serialized = JSON.stringify(response);
    expect(serialized).not.toMatch(
      /objectKey|sourceListingDraftId|sellerProfileId|userId|autoMessage/,
    );
  });

  it('returns PRODUCT_NOT_FOUND and never signs an invisible detail', async () => {
    findFirst.mockResolvedValueOnce(candidate('hidden', false));
    await expect(service.detail('product-hidden')).rejects.toMatchObject({
      statusCode: 404,
      code: 'PRODUCT_NOT_FOUND',
    });
    expect(storage.createReadUrl).not.toHaveBeenCalled();
  });

  it('propagates signing failure for the global HTTP filter to sanitize', async () => {
    findMany.mockResolvedValueOnce([candidate('failure')]);
    storage.createReadUrl.mockRejectedValueOnce(new Error('private storage credentials'));
    await expect(
      service.list({ page: 1, limit: 24, sort: PublicCatalogSort.RECENT }),
    ).rejects.toThrow('private storage credentials');
  });
});
