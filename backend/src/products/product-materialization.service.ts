import { ConflictException, HttpStatus, Injectable } from '@nestjs/common';
import {
  CatalogEntityStatus,
  ListingDraftModel,
  ListingDraftServicePricingType,
  ListingDraftVariantStatus,
  Prisma,
  ProductStatus,
  ProductVariantStatus,
  SecurityEventOutcome,
  SecurityEventType,
  SellerProfileStatus,
} from '@prisma/client';
import { AppError } from '../common/errors/app-error';
import { PrismaService } from '../database/prisma.service';

const productInclude = {
  variants: { orderBy: [{ sortOrder: 'asc' as const }, { id: 'asc' as const }] },
  attributes: true,
  serviceDetails: true,
  accountDetails: true,
  sellerProfile: true,
  category: true,
  subcategory: true,
};
const draftInclude = {
  sellerProfile: true,
  category: true,
  subcategory: true,
  variants: { orderBy: [{ sortOrder: 'asc' as const }, { id: 'asc' as const }] },
  attributes: true,
  serviceDetails: true,
  accountDetails: true,
};
type Tx = Prisma.TransactionClient;
type Draft = Prisma.ListingDraftGetPayload<{ include: typeof draftInclude }>;
type ProductFull = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

@Injectable()
export class ProductMaterializationService {
  constructor(private readonly prisma: PrismaService) {}

  productReference(product: Pick<ProductFull, 'id' | 'slug' | 'status'>) {
    return { id: product.id, slug: product.slug, status: product.status };
  }

  map(product: ProductFull) {
    return {
      id: product.id,
      sourceListingDraftId: product.sourceListingDraftId,
      status: product.status,
      slug: product.slug,
      title: product.title,
      description: product.description,
      model: product.model,
      productType: product.productType,
      price: product.price?.toFixed(2) ?? null,
      stock: product.stock,
      deliveryMode: product.deliveryMode,
      autoMessage: product.autoMessage,
      version: product.version,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
      seller: {
        id: product.sellerProfile.id,
        storeName: product.sellerProfile.storeName,
        slug: product.sellerProfile.slug,
        status: product.sellerProfile.status,
      },
      category: {
        id: product.category.id,
        slug: product.category.slug,
        name: product.category.name,
      },
      subcategory: product.subcategory
        ? {
            id: product.subcategory.id,
            slug: product.subcategory.slug,
            name: product.subcategory.name,
          }
        : null,
      variants: product.variants.map((v) => ({
        id: v.id,
        title: v.title,
        description: v.description,
        price: v.price?.toFixed(2) ?? null,
        stock: v.stock,
        status: v.status,
        sortOrder: v.sortOrder,
      })),
      attributes: product.attributes.map((a) => ({ key: a.key, value: a.value })),
      serviceDetails: product.serviceDetails
        ? {
            pricingType: product.serviceDetails.pricingType,
            basePrice: product.serviceDetails.basePrice?.toFixed(2) ?? null,
            estimatedDelivery: product.serviceDetails.estimatedDelivery,
            buyerRequirements: product.serviceDetails.buyerRequirements,
            notes: product.serviceDetails.notes,
          }
        : null,
      accountDetails: product.accountDetails
        ? {
            provenance: product.accountDetails.provenance,
            recoveryLevel: product.accountDetails.recoveryLevel,
            emailVerified: product.accountDetails.emailVerified,
            phoneLinked: product.accountDetails.phoneLinked,
            documentLinked: product.accountDetails.documentLinked,
            fullAccess: product.accountDetails.fullAccess,
            recoveryRisk: product.accountDetails.recoveryRisk,
            warrantyNote: product.accountDetails.warrantyNote,
          }
        : null,
    };
  }

  async listForSeller(
    userId: string,
    q: { status?: ProductStatus; limit?: number; cursor?: string },
  ) {
    const seller = await this.prisma.sellerProfile.findUnique({ where: { userId } });
    if (!seller)
      throw new AppError(
        'SELLER_PROFILE_ACTIVE_REQUIRED',
        'SELLER_PROFILE_ACTIVE_REQUIRED',
        HttpStatus.FORBIDDEN,
        [],
      );
    const products = await this.prisma.product.findMany({
      where: { sellerProfileId: seller.id, ...(q.status ? { status: q.status } : {}) },
      include: productInclude,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: Math.min(q.limit ?? 20, 50),
    });
    return { items: products.map((p) => this.map(p)), nextCursor: null };
  }

  async getForSeller(userId: string, id: string) {
    const seller = await this.prisma.sellerProfile.findUnique({ where: { userId } });
    if (!seller) throw new AppError('PRODUCT_NOT_FOUND', 'PRODUCT_NOT_FOUND', 404, []);
    const product = await this.prisma.product.findFirst({
      where: { id, sellerProfileId: seller.id },
      include: productInclude,
    });
    if (!product) throw new AppError('PRODUCT_NOT_FOUND', 'PRODUCT_NOT_FOUND', 404, []);
    return this.map(product);
  }

  async adminList(q: {
    status?: ProductStatus;
    seller?: string;
    categoryId?: string;
    limit?: number;
  }) {
    const products = await this.prisma.product.findMany({
      where: {
        ...(q.status ? { status: q.status } : {}),
        ...(q.categoryId ? { categoryId: q.categoryId } : {}),
        ...(q.seller
          ? { sellerProfile: { storeName: { contains: q.seller, mode: 'insensitive' } } }
          : {}),
      },
      include: productInclude,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: Math.min(q.limit ?? 20, 50),
    });
    return { items: products.map((p) => this.map(p)), nextCursor: null };
  }

  async adminGet(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: productInclude,
    });
    if (!product) throw new AppError('PRODUCT_NOT_FOUND', 'PRODUCT_NOT_FOUND', 404, []);
    return this.map(product);
  }

  async materializeFromApprovedDraft(
    tx: Tx,
    draftId: string,
    adminUserId: string,
    mode: 'approval' | 'reconciliation',
  ) {
    const existing = await tx.product.findUnique({
      where: { sourceListingDraftId: draftId },
      include: productInclude,
    });
    if (existing) return existing;
    const draft = await tx.listingDraft.findUnique({
      where: { id: draftId },
      include: draftInclude,
    });
    if (!draft) throw new AppError('LISTING_DRAFT_NOT_FOUND', 'LISTING_DRAFT_NOT_FOUND', 404, []);
    this.assertMaterializable(draft);
    const slug = await this.uniqueSlug(tx, this.productTitle(draft), draft.id);
    try {
      const product = await tx.product.create({
        data: {
          sourceListingDraftId: draft.id,
          sellerProfileId: draft.sellerProfileId,
          categoryId: draft.categoryId!,
          subcategoryId: draft.subcategoryId,
          productType: draft.productType!,
          model: draft.model,
          status: ProductStatus.UNPUBLISHED,
          slug,
          title: this.productTitle(draft),
          description: this.productDescription(draft),
          price:
            draft.model === ListingDraftModel.NORMAL
              ? draft.price
              : (draft.serviceDetails?.basePrice ?? null),
          stock: draft.model === ListingDraftModel.NORMAL ? draft.stock : null,
          deliveryMode: draft.deliveryMode,
          autoMessage: draft.autoMessage,
          variants: { create: this.variantData(draft) },
          attributes: { create: draft.attributes.map((a) => ({ key: a.key, value: a.value })) },
          serviceDetails: draft.serviceDetails
            ? {
                create: {
                  pricingType: draft.serviceDetails.pricingType!,
                  basePrice: draft.serviceDetails.basePrice,
                  estimatedDelivery: draft.serviceDetails.estimatedDelivery,
                  buyerRequirements: draft.serviceDetails.buyerRequirements,
                  notes: draft.serviceDetails.notes,
                },
              }
            : undefined,
          accountDetails: draft.accountDetails
            ? {
                create: {
                  provenance: draft.accountDetails.provenance,
                  recoveryLevel: draft.accountDetails.recoveryLevel,
                  emailVerified: draft.accountDetails.emailVerified,
                  phoneLinked: draft.accountDetails.phoneLinked,
                  documentLinked: draft.accountDetails.documentLinked,
                  fullAccess: draft.accountDetails.fullAccess,
                  recoveryRisk: draft.accountDetails.recoveryRisk,
                  warrantyNote: draft.accountDetails.warrantyNote,
                },
              }
            : undefined,
        },
        include: productInclude,
      });
      await tx.securityEvent.create({
        data: {
          userId: adminUserId,
          eventType: SecurityEventType.PRODUCT_MATERIALIZED,
          outcome: SecurityEventOutcome.SUCCESS,
          metadata: {
            draftId,
            productId: product.id,
            sellerProfileId: draft.sellerProfileId,
            adminUserId,
            draftVersion: draft.version,
            productStatus: product.status,
            mode,
          },
        },
      });
      return product;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const product = await tx.product.findUnique({
          where: { sourceListingDraftId: draftId },
          include: productInclude,
        });
        if (product) return product;
      }
      throw e;
    }
  }

  publicSlugBaseForTest(title: string) {
    return this.slugBase(title);
  }
  publicStableSuffixForTest(id: string) {
    return this.stableSuffix(id);
  }
  publicVariantDataForTest(draft: Parameters<ProductMaterializationService['variantData']>[0]) {
    return this.variantData(draft);
  }

  private assertMaterializable(d: Draft) {
    if (!d.sellerProfile || d.sellerProfile.status !== SellerProfileStatus.ACTIVE)
      throw new AppError(
        'SELLER_PROFILE_ACTIVE_REQUIRED',
        'SELLER_PROFILE_ACTIVE_REQUIRED',
        409,
        [],
      );
    if (
      !d.categoryId ||
      !d.productType ||
      !d.category ||
      d.category.status !== CatalogEntityStatus.ACTIVE
    )
      throw new AppError('LISTING_TAXONOMY_INACTIVE', 'LISTING_TAXONOMY_INACTIVE', 400, []);
    if (d.subcategory && d.subcategory.status !== CatalogEntityStatus.ACTIVE)
      throw new AppError('LISTING_TAXONOMY_INACTIVE', 'LISTING_TAXONOMY_INACTIVE', 400, []);
    if (d.model === ListingDraftModel.SERVICE && !d.serviceDetails?.pricingType)
      throw new ConflictException({ code: 'LISTING_REQUIRED_FIELD_MISSING' });
  }
  private productTitle(d: Draft) {
    return (
      (d.model === ListingDraftModel.SERVICE ? d.serviceDetails?.title : d.title) ??
      'Produto aprovado'
    );
  }
  private productDescription(d: Draft) {
    return (
      (d.model === ListingDraftModel.SERVICE ? d.serviceDetails?.description : d.description) ?? ''
    );
  }
  private slugBase(title: string) {
    return (
      title
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 72) || 'produto'
    );
  }
  private stableSuffix(id: string) {
    return id.replace(/-/g, '').slice(0, 8);
  }
  private async uniqueSlug(tx: Tx, title: string, draftId: string) {
    const base = this.slugBase(title);
    const stable = `${base}-${this.stableSuffix(draftId)}`;
    if (!(await tx.product.findUnique({ where: { slug: base } }))) return base;
    return stable;
  }
  private variantData(d: Draft) {
    if (d.model === ListingDraftModel.DYNAMIC)
      return d.variants.map((v) => ({
        title: v.title,
        description: v.description,
        price: v.price,
        stock: v.stock,
        sortOrder: v.sortOrder,
        status:
          v.status === ListingDraftVariantStatus.PAUSED
            ? ProductVariantStatus.PAUSED
            : ProductVariantStatus.ACTIVE,
      }));
    if (d.model === ListingDraftModel.NORMAL)
      return [
        {
          title: d.title ?? 'Padrão',
          description: d.description,
          price: d.price,
          stock: d.stock,
          sortOrder: 0,
          status: ProductVariantStatus.ACTIVE,
        },
      ];
    if (d.serviceDetails?.pricingType === ListingDraftServicePricingType.FIXED)
      return [
        {
          title: d.serviceDetails.title ?? 'Serviço',
          description: d.serviceDetails.description,
          price: d.serviceDetails.basePrice,
          stock: null,
          sortOrder: 0,
          status: ProductVariantStatus.ACTIVE,
        },
      ];
    return [];
  }
}
