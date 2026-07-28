import { Inject, Injectable } from '@nestjs/common';
import {
  CatalogEntityStatus,
  ListingDraftModel,
  ListingDraftServicePricingType,
  ListingDraftStatus,
  Prisma,
  ProductImageStatus,
  ProductStatus,
  ProductVariantStatus,
  SellerProfileStatus,
} from '@prisma/client';
import { AppError } from '../common/errors/app-error';
import { PrismaService } from '../database/prisma.service';
import {
  PRODUCT_IMAGE_STORAGE,
  type ProductImageStorage,
} from '../product-images/product-image.storage';
import { PublicCatalogQueryDto, PublicCatalogSort } from './public-product-catalog.dto';
import { publicationEligibilityCode } from './product-publication.rules';

const relations = {
  sellerProfile: true,
  sourceListingDraft: true,
  category: true,
  subcategory: true,
  variants: { orderBy: [{ sortOrder: 'asc' as const }, { id: 'asc' as const }] },
  images: { orderBy: [{ sortOrder: 'asc' as const }, { id: 'asc' as const }] },
  serviceDetails: true,
} satisfies Prisma.ProductInclude;
type Candidate = Prisma.ProductGetPayload<{ include: typeof relations }>;

export const shortDescription = (value: string) => value.replace(/\s+/g, ' ').trim().slice(0, 160);
const money = (value: { toFixed(scale: number): string } | null) => value?.toFixed(2) ?? null;

export function publicPricing(product: Candidate) {
  if (product.model === ListingDraftModel.NORMAL)
    return { kind: 'FIXED' as const, amount: money(product.price) };
  if (product.model === ListingDraftModel.DYNAMIC) {
    const prices = product.variants
      .filter((variant) => variant.status === ProductVariantStatus.ACTIVE && variant.price)
      .map((variant) => variant.price!)
      .sort((a, b) => a.comparedTo(b));
    return { kind: 'FROM' as const, amount: money(prices[0] ?? null) };
  }
  if (product.serviceDetails?.pricingType === ListingDraftServicePricingType.QUOTE)
    return { kind: 'QUOTE' as const, amount: null };
  return { kind: 'FIXED' as const, amount: money(product.serviceDetails?.basePrice ?? null) };
}

export function publicStock(product: Candidate): number | null {
  if (product.model === ListingDraftModel.NORMAL) return product.stock;
  if (product.model === ListingDraftModel.SERVICE) return null;
  const active = product.variants.filter(
    (variant) => variant.status === ProductVariantStatus.ACTIVE,
  );
  return active.some((variant) => variant.stock === null)
    ? null
    : active.reduce((sum, variant) => sum + variant.stock!, 0);
}

export const publicOrderBy = (
  sort: PublicCatalogSort,
): Prisma.ProductOrderByWithRelationInput[] => {
  if (sort === PublicCatalogSort.OLDEST) return [{ updatedAt: 'asc' }, { id: 'asc' }];
  if (sort === PublicCatalogSort.TITLE_ASC) return [{ title: 'asc' }, { id: 'asc' }];
  if (sort === PublicCatalogSort.TITLE_DESC) return [{ title: 'desc' }, { id: 'desc' }];
  return [{ updatedAt: 'desc' }, { id: 'desc' }];
};

@Injectable()
export class PublicProductCatalogService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(PRODUCT_IMAGE_STORAGE) private readonly storage: ProductImageStorage,
  ) {}

  async list(query: PublicCatalogQueryDto) {
    const wanted = query.page * query.limit + 1;
    const eligible: Candidate[] = [];
    let rawOffset = 0;
    const batchSize = Math.max(100, query.limit * 2);
    const where = this.publicPrefilter(query);
    while (eligible.length < wanted) {
      const batch = await this.prisma.product.findMany({
        where,
        include: relations,
        orderBy: publicOrderBy(query.sort),
        skip: rawOffset,
        take: batchSize,
      });
      for (const product of batch)
        if (publicationEligibilityCode(product) === null) eligible.push(product);
      rawOffset += batch.length;
      if (batch.length < batchSize) break;
    }
    const start = (query.page - 1) * query.limit;
    const selected = eligible.slice(start, start + query.limit);
    const items = await Promise.all(selected.map((product) => this.card(product)));
    return {
      items,
      pagination: {
        page: query.page,
        limit: query.limit,
        hasNext: eligible.length > start + query.limit,
      },
    };
  }

  async detail(slug: string) {
    const product = await this.prisma.product.findFirst({
      where: { ...this.publicPrefilter({ slug } as never), slug },
      include: relations,
    });
    if (!product || publicationEligibilityCode(product) !== null)
      throw new AppError('PRODUCT_NOT_FOUND', 'PRODUCT_NOT_FOUND', 404, []);
    const gallery = await Promise.all(
      product.images
        .filter((image) => image.status === ProductImageStatus.READY)
        .map(async (image) => ({
          id: image.id,
          ...(await this.signed(image.objectKey)),
          altText: image.altText,
          isCover: image.isCover,
        })),
    );
    const coverImage = gallery.find((image) => image.isCover)!;
    const card = await this.card(product, {
      url: coverImage.url,
      expiresAt: coverImage.expiresAt,
    });
    return {
      ...card,
      description: product.description,
      deliveryMode: product.deliveryMode,
      variants: product.variants
        .filter((variant) => variant.status === ProductVariantStatus.ACTIVE)
        .map(({ id, title, description, price, stock }) => ({
          id,
          title,
          description,
          price: money(price),
          stock,
        })),
      gallery,
      serviceDetails: product.serviceDetails
        ? {
            pricingType: product.serviceDetails.pricingType,
            basePrice: money(product.serviceDetails.basePrice),
            estimatedDelivery: product.serviceDetails.estimatedDelivery,
          }
        : null,
    };
  }

  private publicPrefilter(query: Partial<PublicCatalogQueryDto>): Prisma.ProductWhereInput {
    return {
      status: ProductStatus.ACTIVE,
      sellerProfile: { status: SellerProfileStatus.ACTIVE },
      sourceListingDraft: { status: ListingDraftStatus.APPROVED },
      category: {
        status: CatalogEntityStatus.ACTIVE,
        ...(query.categorySlug ? { slug: query.categorySlug } : {}),
      },
      OR: [
        { subcategoryId: null },
        {
          subcategory: {
            status: CatalogEntityStatus.ACTIVE,
            ...(query.subcategorySlug ? { slug: query.subcategorySlug } : {}),
          },
        },
      ],
      ...(query.subcategorySlug
        ? { subcategory: { slug: query.subcategorySlug, status: 'ACTIVE' } }
        : {}),
      ...(query.productType ? { productType: query.productType } : {}),
      images: { some: { status: ProductImageStatus.READY, isCover: true } },
    };
  }

  private async card(product: Candidate, signedCover?: { url: string; expiresAt: string }) {
    const cover = product.images.find(
      (image) => image.status === ProductImageStatus.READY && image.isCover,
    )!;
    return {
      id: product.id,
      slug: product.slug,
      title: product.title,
      shortDescription: shortDescription(product.description),
      productType: product.productType,
      model: product.model,
      pricing: publicPricing(product),
      stock: publicStock(product),
      category: { slug: product.category.slug, name: product.category.name },
      subcategory: product.subcategory
        ? { slug: product.subcategory.slug, name: product.subcategory.name }
        : null,
      seller: { slug: product.sellerProfile.slug, storeName: product.sellerProfile.storeName },
      coverImage: {
        ...(signedCover ?? (await this.signed(cover.objectKey))),
        altText: cover.altText,
      },
    };
  }

  private async signed(objectKey: string) {
    const { readUrl, expiresAt } = await this.storage.createReadUrl(objectKey);
    return { url: readUrl, expiresAt: expiresAt.toISOString() };
  }
}
