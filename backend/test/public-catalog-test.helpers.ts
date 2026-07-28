import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import type {
  CatalogProductType,
  ListingDraftModel,
  ListingDraftServicePricingType,
  ListingDraftStatus,
  ProductImageStatus,
  ProductStatus,
  ProductVariantStatus,
  SellerProfileStatus,
} from '@prisma/client';
import type { PrismaService } from '../src/database/prisma.service';

export type CatalogFixtureOptions = {
  slug?: string;
  title?: string;
  updatedAt?: Date;
  productId?: string;
  productStatus?: ProductStatus;
  sellerStatus?: SellerProfileStatus;
  draftStatus?: ListingDraftStatus;
  productType?: CatalogProductType;
  draftProductType?: CatalogProductType;
  model?: ListingDraftModel;
  categoryStatus?: 'ACTIVE' | 'INACTIVE';
  subcategoryStatus?: 'ACTIVE' | 'INACTIVE';
  categoryMismatch?: boolean;
  subcategoryMismatch?: boolean;
  incompatibleSubcategory?: boolean;
  withoutSubcategory?: boolean;
  coverCount?: number;
  coverStatus?: ProductImageStatus;
  invalidVariant?: boolean;
  servicePricingType?: ListingDraftServicePricingType;
  invalidService?: boolean;
};

export async function truncateCatalog(prisma: PrismaService) {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "User", "CatalogCategory" CASCADE');
}

export async function createCatalogFixture(
  prisma: PrismaService,
  options: CatalogFixtureOptions = {},
) {
  const suffix = randomUUID();
  const user = await prisma.user.create({
    data: {
      email: `catalog-${suffix}@example.test`,
      birthDate: new Date('2000-01-01'),
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
      termsVersion: 'test',
      termsAcceptedAt: new Date(),
      privacyVersion: 'test',
      privacyAcceptedAt: new Date(),
    },
  });
  const seller = await prisma.sellerProfile.create({
    data: {
      userId: user.id,
      slug: `seller-${suffix}`,
      storeName: `Seller ${suffix}`,
      status: options.sellerStatus ?? 'ACTIVE',
    },
  });
  const category = await prisma.catalogCategory.create({
    data: {
      slug: `category-${suffix}`,
      name: `Category ${suffix}`,
      status: options.categoryStatus ?? 'ACTIVE',
    },
  });
  const otherCategory = await prisma.catalogCategory.create({
    data: { slug: `other-${suffix}`, name: 'Other', status: 'ACTIVE' },
  });
  const subcategory = options.withoutSubcategory
    ? null
    : await prisma.catalogSubcategory.create({
        data: {
          categoryId: options.incompatibleSubcategory ? otherCategory.id : category.id,
          slug: `subcategory-${suffix}`,
          name: `Subcategory ${suffix}`,
          status: options.subcategoryStatus ?? 'ACTIVE',
        },
      });
  const productType = options.productType ?? 'ACCOUNT';
  const model = options.model ?? 'NORMAL';
  const draft = await prisma.listingDraft.create({
    data: {
      sellerProfileId: seller.id,
      categoryId: options.categoryMismatch ? otherCategory.id : category.id,
      subcategoryId: options.subcategoryMismatch ? null : subcategory?.id,
      productType: options.draftProductType ?? productType,
      model,
      status: options.draftStatus ?? 'APPROVED',
      title: options.title ?? `Product ${suffix}`,
      description: '  Real catalog   description  ',
      price: model === 'NORMAL' ? new Prisma.Decimal('19.90') : null,
      stock: model === 'NORMAL' ? 7 : null,
    },
  });
  const product = await prisma.product.create({
    data: {
      ...(options.productId ? { id: options.productId } : {}),
      sourceListingDraftId: draft.id,
      sellerProfileId: seller.id,
      categoryId: category.id,
      subcategoryId: subcategory?.id,
      productType,
      model,
      status: options.productStatus ?? 'ACTIVE',
      slug: options.slug ?? `product-${suffix}`,
      title: options.title ?? `Product ${suffix}`,
      description: '  Real catalog   description  ',
      price: model === 'NORMAL' ? new Prisma.Decimal('19.90') : null,
      stock: model === 'NORMAL' ? 7 : null,
      autoMessage: 'private automatic message',
      ...(options.updatedAt ? { updatedAt: options.updatedAt } : {}),
    },
  });
  if (model === 'SERVICE') {
    const pricingType = options.servicePricingType ?? 'QUOTE';
    await prisma.productServiceDetails.create({
      data: {
        productId: product.id,
        pricingType,
        basePrice:
          pricingType === 'FIXED' && !options.invalidService ? new Prisma.Decimal('25.00') : null,
        estimatedDelivery: '2 days',
        buyerRequirements: 'private requirements',
        notes: 'private notes',
      },
    });
    if (pricingType === 'FIXED')
      await prisma.productVariant.create({
        data: {
          productId: product.id,
          title: 'Service',
          price: options.invalidService ? null : new Prisma.Decimal('25.00'),
          stock: null,
        },
      });
  } else {
    await prisma.productVariant.create({
      data: {
        productId: product.id,
        title: 'Primary variant',
        description: 'Public variant',
        price: new Prisma.Decimal('19.90'),
        stock: 7,
        status: options.invalidVariant ? 'PAUSED' : 'ACTIVE',
        sortOrder: 10,
      },
    });
  }
  const images = [];
  for (let index = 0; index < (options.coverCount ?? 1); index += 1) {
    const status = options.coverStatus ?? 'READY';
    images.push(
      await prisma.productImage.create({
        data: {
          productId: product.id,
          objectKey: `catalog/${product.id}/cover-${index}.png`,
          status,
          contentType: 'image/png',
          sizeBytes: 10,
          altText: `Cover ${index}`,
          sortOrder: index,
          isCover: status === 'READY',
          uploadedAt: status === 'READY' ? new Date() : null,
          uploadExpiresAt: new Date(Date.now() + 300_000),
          deletedAt: status === 'DELETED' ? new Date() : null,
        },
      }),
    );
  }
  return { user, seller, category, otherCategory, subcategory, draft, product, images };
}

export async function addImage(
  prisma: PrismaService,
  productId: string,
  input: { status: ProductImageStatus; sortOrder: number; isCover?: boolean; key?: string },
) {
  return prisma.productImage.create({
    data: {
      productId,
      objectKey: input.key ?? `catalog/${productId}/${randomUUID()}.png`,
      status: input.status,
      contentType: 'image/png',
      sizeBytes: 10,
      altText: input.status,
      sortOrder: input.sortOrder,
      isCover: input.status === 'READY' ? (input.isCover ?? false) : false,
      uploadedAt: input.status === 'READY' ? new Date() : null,
      uploadExpiresAt: new Date(Date.now() + 300_000),
      deletedAt: input.status === 'DELETED' ? new Date() : null,
    },
  });
}

export async function addVariant(
  prisma: PrismaService,
  productId: string,
  input: { status: ProductVariantStatus; sortOrder: number; title: string },
) {
  return prisma.productVariant.create({
    data: {
      productId,
      title: input.title,
      price: new Prisma.Decimal('30.00'),
      stock: 2,
      status: input.status,
      sortOrder: input.sortOrder,
    },
  });
}
