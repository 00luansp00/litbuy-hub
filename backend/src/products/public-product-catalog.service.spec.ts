import {
  ListingDraftModel,
  ListingDraftServicePricingType,
  Prisma,
  ProductVariantStatus,
} from '@prisma/client';
import {
  publicOrderBy,
  publicPricing,
  publicStock,
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
