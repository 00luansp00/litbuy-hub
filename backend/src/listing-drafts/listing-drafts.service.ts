import { ConflictException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import {
  CatalogAttributeInputType,
  CatalogEntityStatus,
  CatalogProductType,
  ListingDraftDeliveryMode,
  ListingDraftModel,
  ListingDraftPromotionPreference,
  ListingDraftSellerPlanPreference,
  ListingDraftServicePricingType,
  ListingDraftStatus,
  ListingDraftVariantStatus,
  Prisma,
  SecurityEventOutcome,
  SecurityEventType,
  SellerProfileStatus,
} from '@prisma/client';
import { AppError } from '../common/errors/app-error';
import { PrismaService } from '../database/prisma.service';
import { API_PRODUCT_TYPE, PRODUCT_TYPE_API } from '../catalog/catalog.constants';
import type {
  AdminDraftQueryDto,
  CreateDraftDto,
  RejectDraftDto,
  SellerDraftQueryDto,
  UpdateDraftDto,
  VersionDto,
} from './dto';

const include = {
  category: true,
  subcategory: true,
  variants: { orderBy: [{ sortOrder: 'asc' as const }, { id: 'asc' as const }] },
  attributes: true,
  serviceDetails: true,
  accountDetails: true,
  sellerProfile: { include: { user: true } },
  reviewedBy: true,
};
type DraftClient = PrismaService | Prisma.TransactionClient;
type DraftWithRelations = Prisma.ListingDraftGetPayload<{ include: typeof include }>;
type DraftUpdateData = {
  model?: ListingDraftModel;
  categoryId?: string | null;
  subcategoryId?: string | null;
  productType?: CatalogProductType | null;
  title?: string | null;
  description?: string | null;
  price?: Prisma.Decimal | null;
  stock?: number | null;
  deliveryMode?: ListingDraftDeliveryMode;
  requestedPromotionTier?: ListingDraftPromotionPreference;
  requestedSellerPlan?: ListingDraftSellerPlanPreference;
  autoMessage?: string | null;
  notifyInApp?: boolean;
  notifyBrowser?: boolean;
  notifyEmailFuture?: boolean;
  notifyExternalFuture?: boolean;
  wizardStep?: number;
  status?: ListingDraftStatus;
  submittedAt?: Date | null;
  reviewStartedAt?: Date | null;
  reviewedAt?: Date | null;
  rejectionCode?: string | null;
  rejectionReason?: string | null;
  approvedAt?: Date | null;
};

export type SellerListingDraftSummary = ReturnType<ListingDraftsService['mapSellerSummary']>;
export type AdminListingDraftSummary = ReturnType<ListingDraftsService['mapAdminSummary']>;
export type SellerListingDraftResponse = ReturnType<ListingDraftsService['mapSeller']>;
export type AdminListingDraftResponse = ReturnType<ListingDraftsService['mapAdmin']>;

const rejectCodes = new Set([
  'CONTENT_INCOMPLETE',
  'CATEGORY_MISMATCH',
  'NEEDS_CLARIFICATION',
  'POLICY_VIOLATION',
  'PROHIBITED_ITEM',
  'OTHER',
]);
@Injectable()
export class ListingDraftsService {
  constructor(private readonly prisma: PrismaService) {}
  private err(code: string, status = HttpStatus.BAD_REQUEST, details?: unknown) {
    return new AppError(code, code, status, Array.isArray(details) ? details : []);
  }
  private text(v: string | number | boolean | null | undefined, max = 5000) {
    if (v == null) return null;
    const s = String(v)
      .replace(/\p{Cc}/gu, ' ')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (s.length > max) throw this.err('LISTING_TEXT_INVALID');
    return s || null;
  }
  private price(v: string | number | null | undefined) {
    if (v == null || v === '') return null;
    const s = String(v).trim();
    if (!/^(?:[1-9]\d{0,9}|0)\.\d{2}$/.test(s) && !/^[1-9]\d{0,9}$/.test(s))
      throw this.err('LISTING_PRICE_INVALID');
    const n = Number(s);
    if (!Number.isFinite(n) || n <= 0 || n > 9999999999) throw this.err('LISTING_PRICE_INVALID');
    return new Prisma.Decimal(s);
  }
  private productType(v: string | null | undefined) {
    if (v === undefined) return undefined;
    if (v === null) return null;
    const upper = v.toUpperCase() as CatalogProductType;
    const t = API_PRODUCT_TYPE[v] ?? (CatalogProductType[upper] ? upper : undefined);
    if (!t) throw this.err('CATALOG_PRODUCT_TYPE_INVALID');
    return t;
  }
  private async sellerProfile(userId: string) {
    const p = await this.prisma.sellerProfile.findUnique({ where: { userId } });
    if (!p || p.status !== SellerProfileStatus.ACTIVE)
      throw this.err('SELLER_PROFILE_ACTIVE_REQUIRED', HttpStatus.FORBIDDEN);
    return p;
  }
  private async sellerProfileInTransaction(tx: DraftClient, userId: string) {
    const p = await tx.sellerProfile.findUnique({ where: { userId } });
    if (!p || p.status !== SellerProfileStatus.ACTIVE)
      throw this.err('SELLER_PROFILE_ACTIVE_REQUIRED', HttpStatus.FORBIDDEN);
    return p;
  }
  private async findOwned(userId: string, id: string, tx: DraftClient = this.prisma) {
    const p = await tx.sellerProfile.findUnique({ where: { userId } });
    if (!p) throw new NotFoundException({ code: 'LISTING_DRAFT_NOT_FOUND' });
    const d = await tx.listingDraft.findFirst({ where: { id, sellerProfileId: p.id }, include });
    if (!d) throw new NotFoundException({ code: 'LISTING_DRAFT_NOT_FOUND' });
    if (p.status !== SellerProfileStatus.ACTIVE)
      throw this.err('SELLER_PROFILE_ACTIVE_REQUIRED', HttpStatus.FORBIDDEN);
    return d;
  }
  private async findFull(tx: DraftClient, id: string): Promise<DraftWithRelations> {
    const d = await tx.listingDraft.findUnique({ where: { id }, include });
    if (!d) throw new NotFoundException({ code: 'LISTING_DRAFT_NOT_FOUND' });
    return d;
  }
  private versionConflict(d: Pick<DraftWithRelations, 'version' | 'updatedAt'>, message: string) {
    return new ConflictException({
      code: 'LISTING_DRAFT_VERSION_CONFLICT',
      currentVersion: d.version,
      updatedAt: d.updatedAt.toISOString(),
      message,
    });
  }
  private mapCore(d: DraftWithRelations) {
    return {
      id: d.id,
      status: d.status,
      model: d.model,
      title: d.title,
      description: d.description,
      category: d.category
        ? { id: d.category.id, slug: d.category.slug, name: d.category.name }
        : null,
      subcategory: d.subcategory
        ? { id: d.subcategory.id, slug: d.subcategory.slug, name: d.subcategory.name }
        : null,
      categoryId: d.categoryId,
      subcategoryId: d.subcategoryId,
      productType: d.productType ? PRODUCT_TYPE_API[d.productType].id : null,
      price: d.price?.toFixed(2) ?? null,
      stock: d.stock,
      deliveryMode: d.deliveryMode,
      requestedPromotionTier: d.requestedPromotionTier,
      requestedSellerPlan: d.requestedSellerPlan,
      autoMessage: d.autoMessage,
      notifications: {
        inApp: d.notifyInApp,
        browser: d.notifyBrowser,
        emailFuture: d.notifyEmailFuture,
        externalIntegrationFuture: d.notifyExternalFuture,
      },
      wizardStep: d.wizardStep,
      version: d.version,
      submittedAt: d.submittedAt?.toISOString() ?? null,
      reviewStartedAt: d.reviewStartedAt?.toISOString() ?? null,
      reviewedAt: d.reviewedAt?.toISOString() ?? null,
      approvedAt: d.approvedAt?.toISOString() ?? null,
      rejectionCode: d.rejectionCode,
      rejectionReason: d.rejectionReason,
      updatedAt: d.updatedAt.toISOString(),
      createdAt: d.createdAt.toISOString(),
      variants: (d.variants ?? []).map((v) => ({
        id: v.id,
        title: v.title,
        description: v.description,
        price: v.price.toFixed(2),
        stock: v.stock,
        status: v.status,
        sortOrder: v.sortOrder,
      })),
      attributes: (d.attributes ?? []).map((a) => ({ key: a.key, value: a.value })),
      serviceDetails: d.serviceDetails
        ? {
            title: d.serviceDetails.title,
            description: d.serviceDetails.description,
            pricingType: d.serviceDetails.pricingType,
            basePrice: d.serviceDetails.basePrice?.toFixed(2) ?? null,
            estimatedDelivery: d.serviceDetails.estimatedDelivery,
            buyerRequirements: d.serviceDetails.buyerRequirements,
            notes: d.serviceDetails.notes,
          }
        : null,
      accountDetails: d.accountDetails
        ? {
            provenance: d.accountDetails.provenance,
            recoveryLevel: d.accountDetails.recoveryLevel,
            emailVerified: d.accountDetails.emailVerified,
            phoneLinked: d.accountDetails.phoneLinked,
            documentLinked: d.accountDetails.documentLinked,
            fullAccess: d.accountDetails.fullAccess,
            recoveryRisk: d.accountDetails.recoveryRisk,
            warrantyNote: d.accountDetails.warrantyNote,
          }
        : null,
      moderationNotice:
        d.status === 'APPROVED'
          ? 'Aprovado pela moderação. A publicação pública ainda não está disponível.'
          : undefined,
    };
  }
  private mapSellerSummary(d: DraftWithRelations) {
    const core = this.mapCore(d);
    return {
      id: core.id,
      status: core.status,
      model: core.model,
      title: core.title,
      category: core.category,
      subcategory: core.subcategory,
      productType: core.productType,
      price: core.price,
      stock: core.stock,
      wizardStep: core.wizardStep,
      version: core.version,
      submittedAt: core.submittedAt,
      updatedAt: core.updatedAt,
      rejectionCode: core.rejectionCode,
      rejectionReason: core.rejectionReason,
      moderationNotice: core.moderationNotice,
    };
  }
  private mapAdminSummary(d: DraftWithRelations) {
    const core = this.mapSellerSummary(d);
    return {
      ...core,
      seller: d.sellerProfile
        ? {
            id: d.sellerProfile.id,
            storeName: d.sellerProfile.storeName,
            slug: d.sellerProfile.slug,
            status: d.sellerProfile.status,
            verified: d.sellerProfile.verified,
          }
        : null,
      reviewer: d.reviewedBy ? { id: d.reviewedBy.id } : null,
      reviewStartedAt: d.reviewStartedAt?.toISOString() ?? null,
      reviewedAt: d.reviewedAt?.toISOString() ?? null,
      approvedAt: d.approvedAt?.toISOString() ?? null,
    };
  }
  private mapSeller(d: DraftWithRelations) {
    return this.mapCore(d);
  }
  private mapAdmin(d: DraftWithRelations) {
    return {
      ...this.mapCore(d),
      seller: d.sellerProfile
        ? {
            id: d.sellerProfile.id,
            storeName: d.sellerProfile.storeName,
            slug: d.sellerProfile.slug,
            status: d.sellerProfile.status,
            verified: d.sellerProfile.verified,
          }
        : null,
      reviewer: d.reviewedBy ? { id: d.reviewedBy.id } : null,
    };
  }
  private async audit(
    tx: DraftClient,
    userId: string | null,
    type: SecurityEventType,
    metadata: Prisma.InputJsonValue,
  ) {
    await tx.securityEvent.create({
      data: { userId, eventType: type, outcome: SecurityEventOutcome.SUCCESS, metadata },
    });
  }
  private async validateTaxonomy(
    tx: DraftClient,
    data: {
      categoryId?: string | null;
      subcategoryId?: string | null;
      productType?: CatalogProductType | null;
      attributes?: { key: string; value: string }[];
    },
    requireActive = false,
  ) {
    if (!data.categoryId) {
      if (data.subcategoryId) throw this.err('LISTING_CATEGORY_NOT_FOUND', 404);
      if (data.productType || (data.attributes?.length ?? 0) > 0)
        throw this.err('LISTING_CATEGORY_NOT_FOUND', 404);
      return [];
    }
    if (!data.productType && (data.attributes?.length ?? 0) > 0)
      throw this.err('CATALOG_PRODUCT_TYPE_INVALID');
    const cat = await tx.catalogCategory.findUnique({ where: { id: data.categoryId } });
    if (!cat) throw this.err('LISTING_CATEGORY_NOT_FOUND', 404);
    if (requireActive && cat.status !== CatalogEntityStatus.ACTIVE)
      throw this.err('LISTING_TAXONOMY_INACTIVE');
    if (data.subcategoryId) {
      const sub = await tx.catalogSubcategory.findUnique({
        where: { id: data.subcategoryId },
      });
      if (!sub) throw this.err('LISTING_SUBCATEGORY_NOT_FOUND', 404);
      if (sub.categoryId !== data.categoryId) throw this.err('LISTING_SUBCATEGORY_NOT_FOUND', 404);
      if (requireActive && sub.status !== CatalogEntityStatus.ACTIVE)
        throw this.err('LISTING_TAXONOMY_INACTIVE');
    }
    const [generic, specific] = await Promise.all([
      data.productType
        ? tx.catalogAttribute.findMany({
            where: {
              productType: data.productType,
              ...(requireActive ? { status: CatalogEntityStatus.ACTIVE } : {}),
            },
          })
        : Promise.resolve([]),
      data.subcategoryId
        ? tx.catalogAttribute.findMany({
            where: {
              subcategoryId: data.subcategoryId,
              ...(requireActive ? { status: CatalogEntityStatus.ACTIVE } : {}),
            },
          })
        : Promise.resolve([]),
    ]);
    const map = new Map<string, (typeof generic)[number]>();
    for (const a of generic) map.set(a.key, a);
    for (const a of specific) map.set(a.key, a);
    const attrs = [...map.values()].sort(
      (a, b) => a.sortOrder - b.sortOrder || a.key.localeCompare(b.key),
    );
    const seen = new Set<string>();
    for (const a of data.attributes ?? []) {
      if (seen.has(a.key)) throw this.err('LISTING_ATTRIBUTE_DUPLICATED');
      seen.add(a.key);
      const cfg = map.get(a.key);
      if (!cfg) throw this.err('LISTING_ATTRIBUTE_UNKNOWN');
      if (!a.value?.trim()) {
        if (cfg.required) throw this.err('LISTING_REQUIRED_ATTRIBUTE_MISSING');
        continue;
      }
      if (cfg.inputType === CatalogAttributeInputType.NUMBER && !/^-?\d+(\.\d+)?$/.test(a.value))
        throw this.err('LISTING_ATTRIBUTE_VALUE_INVALID');
      if (
        cfg.inputType === CatalogAttributeInputType.BOOLEAN &&
        !['true', 'false'].includes(a.value)
      )
        throw this.err('LISTING_ATTRIBUTE_VALUE_INVALID');
      if (
        cfg.inputType === CatalogAttributeInputType.SELECT &&
        !cfg.selectOptions.includes(a.value)
      )
        throw this.err('LISTING_ATTRIBUTE_VALUE_INVALID');
    }
    if (requireActive)
      for (const cfg of attrs)
        if (
          cfg.required &&
          !(data.attributes ?? []).some((a) => a.key === cfg.key && a.value.trim())
        )
          throw this.err('LISTING_REQUIRED_ATTRIBUTE_MISSING');
  }
  private assertModelConsistency(snapshot: {
    model?: ListingDraftModel | null;
    productType?: CatalogProductType | null;
    price?: Prisma.Decimal | null;
    stock?: number | null;
    variants?: unknown[];
    serviceDetails?: object | null;
    accountDetails?: object | null;
  }) {
    if (snapshot.accountDetails && snapshot.productType !== CatalogProductType.ACCOUNT)
      throw this.err('LISTING_ACCOUNT_DETAILS_NOT_ALLOWED', HttpStatus.CONFLICT);
    if (snapshot.model === ListingDraftModel.NORMAL) {
      if ((snapshot.variants?.length ?? 0) > 0)
        throw this.err('LISTING_VARIANTS_NOT_ALLOWED', HttpStatus.CONFLICT);
      if (snapshot.serviceDetails)
        throw this.err('LISTING_SERVICE_DETAILS_NOT_ALLOWED', HttpStatus.CONFLICT);
    }
    if (snapshot.model === ListingDraftModel.DYNAMIC) {
      if (snapshot.serviceDetails)
        throw this.err('LISTING_SERVICE_DETAILS_NOT_ALLOWED', HttpStatus.CONFLICT);
    }
    if (snapshot.model === ListingDraftModel.SERVICE) {
      if (snapshot.price || snapshot.stock != null || (snapshot.variants?.length ?? 0) > 0)
        throw this.err('LISTING_MODEL_DATA_CONFLICT', HttpStatus.CONFLICT);
      if (snapshot.accountDetails)
        throw this.err('LISTING_ACCOUNT_DETAILS_NOT_ALLOWED', HttpStatus.CONFLICT);
    }
  }
  private validateSubmit(d: DraftWithRelations) {
    if (d.deliveryMode === ListingDraftDeliveryMode.AUTOMATIC)
      throw this.err('LISTING_AUTOMATIC_DELIVERY_UNAVAILABLE', 409);
    if (!d.categoryId || !d.productType) throw this.err('LISTING_REQUIRED_FIELD_MISSING');
    const title = this.text(
      d.model === ListingDraftModel.SERVICE ? d.serviceDetails?.title : d.title,
      140,
    );
    const desc = this.text(
      d.model === ListingDraftModel.SERVICE ? d.serviceDetails?.description : d.description,
      5000,
    );
    if (!title || title.length < 5 || !desc || desc.length < 10)
      throw this.err('LISTING_REQUIRED_FIELD_MISSING');
    if (d.model === ListingDraftModel.NORMAL && (!d.price || !d.stock || d.stock < 1))
      throw this.err('LISTING_REQUIRED_FIELD_MISSING');
    if (
      d.model === ListingDraftModel.DYNAMIC &&
      (!d.variants?.length ||
        !d.variants.some((v) => v.status === ListingDraftVariantStatus.ACTIVE && v.stock > 0))
    )
      throw this.err('LISTING_REQUIRED_FIELD_MISSING');
    if (d.model === ListingDraftModel.SERVICE) {
      if (!d.serviceDetails?.pricingType) throw this.err('LISTING_REQUIRED_FIELD_MISSING');
      if (
        d.serviceDetails.pricingType === ListingDraftServicePricingType.FIXED &&
        !d.serviceDetails.basePrice
      )
        throw this.err('LISTING_REQUIRED_FIELD_MISSING');
      if (
        d.serviceDetails.pricingType === ListingDraftServicePricingType.QUOTE &&
        d.serviceDetails.basePrice
      )
        throw this.err('LISTING_PRICE_INVALID');
      if (d.stock !== null || d.variants?.length || d.accountDetails)
        throw this.err('LISTING_SERVICE_MODEL_INVALID');
    }
  }
  private dataFromDto(dto: CreateDraftDto | UpdateDraftDto): DraftUpdateData {
    const data: DraftUpdateData = {};
    if ('model' in dto) data.model = dto.model;
    if ('categoryId' in dto) data.categoryId = dto.categoryId;
    if ('subcategoryId' in dto) data.subcategoryId = dto.subcategoryId;
    if ('deliveryMode' in dto) data.deliveryMode = dto.deliveryMode;
    if ('requestedPromotionTier' in dto) data.requestedPromotionTier = dto.requestedPromotionTier;
    if ('requestedSellerPlan' in dto) data.requestedSellerPlan = dto.requestedSellerPlan;
    if ('notifyInApp' in dto) data.notifyInApp = dto.notifyInApp;
    if ('notifyBrowser' in dto) data.notifyBrowser = dto.notifyBrowser;
    if ('notifyEmailFuture' in dto) data.notifyEmailFuture = dto.notifyEmailFuture;
    if ('notifyExternalFuture' in dto) data.notifyExternalFuture = dto.notifyExternalFuture;
    if ('wizardStep' in dto) data.wizardStep = dto.wizardStep;
    if ('productType' in dto) data.productType = this.productType(dto.productType);
    if ('title' in dto) data.title = this.text(dto.title, 140);
    if ('description' in dto) data.description = this.text(dto.description, 5000);
    if ('autoMessage' in dto) data.autoMessage = this.text(dto.autoMessage, 1000);
    if ('price' in dto) data.price = this.price(dto.price);
    if ('stock' in dto) data.stock = dto.stock;
    return data;
  }
  async create(userId: string, dto: CreateDraftDto) {
    const data = this.dataFromDto(dto);
    return this.prisma.$transaction(async (tx) => {
      const p = await this.sellerProfileInTransaction(tx, userId);
      await this.validateTaxonomy(tx, { ...data, attributes: dto.attributes ?? [] });
      this.assertModelConsistency({
        ...data,
        variants: dto.variants ?? [],
        serviceDetails: dto.serviceDetails,
        accountDetails: dto.accountDetails,
      });
      const d = await tx.listingDraft.create({
        data: {
          ...data,
          sellerProfileId: p.id,
          attributes: dto.attributes
            ? {
                create: dto.attributes.map((a) => ({
                  key: a.key,
                  value: this.text(a.value, 500) ?? '',
                })),
              }
            : undefined,
        },
        include,
      });
      if (dto.variants) await this.replaceVariants(tx, d.id, dto.variants);
      if (dto.serviceDetails)
        await tx.listingDraftServiceDetails.create({
          data: this.serviceDetailsData(dto.serviceDetails, d.id),
        });
      if (dto.accountDetails)
        await tx.listingDraftAccountDetails.create({
          data: this.accountDetailsData(dto.accountDetails, d.id),
        });
      await this.audit(tx, userId, SecurityEventType.LISTING_DRAFT_CREATED, {
        draftId: d.id,
        sellerProfileId: p.id,
        statusNew: d.status,
        versionNew: d.version,
      });
      return this.mapSeller(await this.findFull(tx, d.id));
    });
  }
  async list(userId: string, q: SellerDraftQueryDto) {
    const p = await this.sellerProfile(userId);
    return this.listWhere({ sellerProfileId: p.id }, q);
  }
  async adminList(q: AdminDraftQueryDto) {
    return this.listWhere(
      {
        ...(q.categoryId ? { categoryId: q.categoryId } : {}),
        ...(q.seller
          ? { sellerProfile: { storeName: { contains: q.seller, mode: 'insensitive' as const } } }
          : {}),
      },
      q,
    );
  }
  private encodeCursor(d: DraftWithRelations) {
    return Buffer.from(JSON.stringify({ updatedAt: d.updatedAt.toISOString(), id: d.id })).toString(
      'base64url',
    );
  }
  private decodeCursor(cursor?: string) {
    if (!cursor) return undefined;
    if (cursor.length > 512 || !/^[A-Za-z0-9_-]+$/.test(cursor))
      throw this.err('LISTING_DRAFT_CURSOR_INVALID');
    try {
      const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString()) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
        throw new Error('invalid cursor');
      const keys = Object.keys(parsed);
      if (keys.length !== 2 || !keys.includes('updatedAt') || !keys.includes('id'))
        throw new Error('invalid cursor');
      const raw = parsed as { updatedAt?: unknown; id?: unknown };
      if (typeof raw.updatedAt !== 'string' || typeof raw.id !== 'string')
        throw new Error('invalid cursor');
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw.id))
        throw new Error('invalid cursor');
      const updatedAt = new Date(raw.updatedAt);
      if (Number.isNaN(updatedAt.getTime()) || updatedAt.toISOString() !== raw.updatedAt)
        throw new Error('invalid cursor');
      return { updatedAt, id: raw.id };
    } catch {
      throw this.err('LISTING_DRAFT_CURSOR_INVALID');
    }
  }
  private async listWhere(where: Prisma.ListingDraftWhereInput, q: SellerDraftQueryDto) {
    const limit = Math.min(q.limit ?? 20, 50);
    const cursor = this.decodeCursor(q.cursor);
    const items = await this.prisma.listingDraft.findMany({
      where: {
        ...where,
        ...(q.status ? { status: q.status } : {}),
        ...(q.search ? { title: { contains: q.search, mode: 'insensitive' } } : {}),
        ...(cursor
          ? {
              OR: [
                { updatedAt: { lt: cursor.updatedAt } },
                { updatedAt: cursor.updatedAt, id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      include,
    });
    const page = items
      .slice(0, limit)
      .map((d) =>
        'sellerProfileId' in where ? this.mapSellerSummary(d) : this.mapAdminSummary(d),
      );
    return {
      items: page,
      nextCursor: items.length > limit ? this.encodeCursor(items[limit - 1]) : null,
    };
  }
  async get(userId: string, id: string) {
    return this.mapSeller(await this.findOwned(userId, id));
  }
  async adminGet(id: string) {
    const d = await this.prisma.listingDraft.findUnique({ where: { id }, include });
    if (!d) throw new NotFoundException({ code: 'LISTING_DRAFT_NOT_FOUND' });
    return this.mapAdmin(d);
  }
  private present(dto: object, key: string) {
    return Object.prototype.hasOwnProperty.call(dto, key);
  }
  private scalarValue(
    draft: DraftWithRelations,
    data: DraftUpdateData,
    key: keyof DraftUpdateData,
  ) {
    return this.present(data, key) ? data[key] : draft[key as keyof DraftWithRelations];
  }
  private normalizeDraftForComparison(
    draft: DraftWithRelations,
    data: DraftUpdateData,
    dto: UpdateDraftDto,
  ) {
    const attributes = this.present(dto, 'attributes')
      ? (dto.attributes ?? []).map((a) => ({ key: a.key, value: this.text(a.value, 500) ?? '' }))
      : draft.attributes.map((a) => ({ key: a.key, value: a.value }));
    attributes.sort((a, b) => a.key.localeCompare(b.key));
    const variants = this.present(dto, 'variants')
      ? (dto.variants ?? []).map((v, index) => ({
          title: this.text(v.title, 140) ?? '',
          description: this.text(v.description, 1000),
          price: this.price(v.price)?.toFixed(2) ?? null,
          stock: v.stock,
          status: v.status ?? ListingDraftVariantStatus.ACTIVE,
          sortOrder: v.sortOrder ?? index,
        }))
      : draft.variants.map((v) => ({
          title: v.title,
          description: v.description,
          price: v.price.toFixed(2),
          stock: v.stock,
          status: v.status,
          sortOrder: v.sortOrder,
        }));
    variants.sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));
    const serviceDetails = this.present(dto, 'serviceDetails')
      ? dto.serviceDetails
        ? this.serviceDetailsComparison(dto.serviceDetails)
        : null
      : draft.serviceDetails
        ? {
            title: draft.serviceDetails.title,
            description: draft.serviceDetails.description,
            pricingType: draft.serviceDetails.pricingType,
            basePrice: draft.serviceDetails.basePrice?.toFixed(2) ?? null,
            estimatedDelivery: draft.serviceDetails.estimatedDelivery,
            buyerRequirements: draft.serviceDetails.buyerRequirements,
            notes: draft.serviceDetails.notes,
          }
        : null;
    const accountDetails = this.present(dto, 'accountDetails')
      ? dto.accountDetails
        ? this.accountDetailsComparison(dto.accountDetails)
        : null
      : draft.accountDetails
        ? {
            provenance: draft.accountDetails.provenance,
            recoveryLevel: draft.accountDetails.recoveryLevel,
            emailVerified: draft.accountDetails.emailVerified,
            phoneLinked: draft.accountDetails.phoneLinked,
            documentLinked: draft.accountDetails.documentLinked,
            fullAccess: draft.accountDetails.fullAccess,
            recoveryRisk: draft.accountDetails.recoveryRisk,
            warrantyNote: draft.accountDetails.warrantyNote,
          }
        : null;
    return JSON.stringify({
      model: this.scalarValue(draft, data, 'model'),
      categoryId: this.scalarValue(draft, data, 'categoryId'),
      subcategoryId: this.scalarValue(draft, data, 'subcategoryId'),
      productType: this.scalarValue(draft, data, 'productType'),
      title: this.scalarValue(draft, data, 'title'),
      description: this.scalarValue(draft, data, 'description'),
      price: this.present(data, 'price')
        ? (data.price?.toFixed(2) ?? null)
        : (draft.price?.toFixed(2) ?? null),
      stock: this.scalarValue(draft, data, 'stock'),
      deliveryMode: this.scalarValue(draft, data, 'deliveryMode'),
      requestedPromotionTier: this.scalarValue(draft, data, 'requestedPromotionTier'),
      requestedSellerPlan: this.scalarValue(draft, data, 'requestedSellerPlan'),
      autoMessage: this.scalarValue(draft, data, 'autoMessage'),
      notifyInApp: this.scalarValue(draft, data, 'notifyInApp'),
      notifyBrowser: this.scalarValue(draft, data, 'notifyBrowser'),
      notifyEmailFuture: this.scalarValue(draft, data, 'notifyEmailFuture'),
      notifyExternalFuture: this.scalarValue(draft, data, 'notifyExternalFuture'),
      wizardStep: this.scalarValue(draft, data, 'wizardStep'),
      attributes,
      variants,
      serviceDetails,
      accountDetails,
    });
  }
  private serviceDetailsComparison(dto: NonNullable<CreateDraftDto['serviceDetails']>) {
    return {
      title: this.text(dto.title, 140),
      description: this.text(dto.description, 5000),
      pricingType: dto.pricingType ?? null,
      basePrice: this.price(dto.basePrice)?.toFixed(2) ?? null,
      estimatedDelivery: this.text(dto.estimatedDelivery, 120),
      buyerRequirements: this.text(dto.buyerRequirements, 1000),
      notes: this.text(dto.notes, 1000),
    };
  }
  private accountDetailsComparison(dto: NonNullable<CreateDraftDto['accountDetails']>) {
    return {
      provenance: dto.provenance ?? null,
      recoveryLevel: dto.recoveryLevel ?? null,
      emailVerified: dto.emailVerified ?? null,
      phoneLinked: dto.phoneLinked ?? null,
      documentLinked: dto.documentLinked ?? null,
      fullAccess: dto.fullAccess ?? null,
      recoveryRisk: dto.recoveryRisk ?? null,
      warrantyNote: this.text(dto.warrantyNote, 1000),
    };
  }
  private async replaceVariants(
    tx: Prisma.TransactionClient,
    draftId: string,
    variants: {
      title: string;
      description?: string | null;
      price: string;
      stock: number;
      status?: ListingDraftVariantStatus;
      sortOrder?: number;
    }[],
  ) {
    await tx.listingDraftVariant.deleteMany({ where: { draftId } });
    if (variants.length)
      await tx.listingDraftVariant.createMany({
        data: variants.map((v, i) => ({
          draftId,
          title: this.text(v.title, 140) ?? '',
          description: this.text(v.description, 1000),
          price: this.price(v.price)!,
          stock: v.stock,
          status: v.status ?? 'ACTIVE',
          sortOrder: v.sortOrder ?? i,
        })),
      });
  }
  private serviceDetailsData(dto: NonNullable<CreateDraftDto['serviceDetails']>, draftId: string) {
    return {
      draftId,
      title: this.text(dto.title, 140),
      description: this.text(dto.description, 5000),
      pricingType: dto.pricingType,
      basePrice: this.price(dto.basePrice),
      estimatedDelivery: this.text(dto.estimatedDelivery, 120),
      buyerRequirements: this.text(dto.buyerRequirements, 1000),
      notes: this.text(dto.notes, 1000),
    };
  }
  private accountDetailsData(dto: NonNullable<CreateDraftDto['accountDetails']>, draftId: string) {
    return {
      draftId,
      provenance: dto.provenance,
      recoveryLevel: dto.recoveryLevel,
      emailVerified: dto.emailVerified,
      phoneLinked: dto.phoneLinked,
      documentLinked: dto.documentLinked,
      fullAccess: dto.fullAccess,
      recoveryRisk: dto.recoveryRisk,
      warrantyNote: this.text(dto.warrantyNote, 1000),
    };
  }
  async update(userId: string, id: string, dto: UpdateDraftDto) {
    return this.prisma.$transaction(async (tx) => {
      const d = await this.findOwned(userId, id, tx);
      if (!['DRAFT', 'REJECTED'].includes(d.status))
        throw this.err('LISTING_DRAFT_NOT_EDITABLE', 409);
      if (d.version !== dto.expectedVersion)
        throw this.versionConflict(d, 'Recarregue o rascunho antes de salvar.');
      const data = this.dataFromDto(dto);
      await this.validateTaxonomy(tx, {
        ...d,
        ...data,
        attributes: dto.attributes ?? d.attributes,
      });
      this.assertModelConsistency({
        ...d,
        ...data,
        variants: dto.variants ?? d.variants,
        serviceDetails: 'serviceDetails' in dto ? dto.serviceDetails : d.serviceDetails,
        accountDetails: 'accountDetails' in dto ? dto.accountDetails : d.accountDetails,
      });
      const hasChildPatch =
        'attributes' in dto ||
        'variants' in dto ||
        'serviceDetails' in dto ||
        'accountDetails' in dto;
      if (Object.keys(data).length === 0 && !hasChildPatch)
        throw this.err('LISTING_DRAFT_UPDATE_EMPTY');
      if (
        this.normalizeDraftForComparison(d, {}, {} as UpdateDraftDto) ===
        this.normalizeDraftForComparison(d, data, dto)
      )
        return this.mapSeller(d);
      const updated = await tx.listingDraft.updateMany({
        where: { id, version: dto.expectedVersion, status: { in: ['DRAFT', 'REJECTED'] } },
        data: { ...data, version: { increment: 1 } },
      });
      if (updated.count !== 1) {
        const current = await this.findOwned(userId, id, tx);
        if (!['DRAFT', 'REJECTED'].includes(current.status))
          throw this.err('LISTING_DRAFT_NOT_EDITABLE', 409);
        throw this.versionConflict(current, 'Recarregue o rascunho antes de salvar.');
      }
      if (dto.attributes) {
        await tx.listingDraftAttributeValue.deleteMany({ where: { draftId: id } });
        if (dto.attributes.length)
          await tx.listingDraftAttributeValue.createMany({
            data: dto.attributes.map((a) => ({
              draftId: id,
              key: a.key,
              value: this.text(a.value, 500) ?? '',
            })),
          });
      }
      if (dto.variants) await this.replaceVariants(tx, id, dto.variants);
      if ('serviceDetails' in dto) {
        await tx.listingDraftServiceDetails.deleteMany({ where: { draftId: id } });
        if (dto.serviceDetails)
          await tx.listingDraftServiceDetails.create({
            data: this.serviceDetailsData(dto.serviceDetails, id),
          });
      }
      if ('accountDetails' in dto) {
        await tx.listingDraftAccountDetails.deleteMany({ where: { draftId: id } });
        if (dto.accountDetails)
          await tx.listingDraftAccountDetails.create({
            data: this.accountDetailsData(dto.accountDetails, id),
          });
      }
      await this.audit(tx, userId, SecurityEventType.LISTING_DRAFT_UPDATED, {
        draftId: id,
        sellerProfileId: d.sellerProfileId,
        statusOld: d.status,
        statusNew: d.status,
        versionOld: d.version,
        versionNew: d.version + 1,
      });
      return this.mapSeller(await this.findFull(tx, id));
    });
  }
  async submit(userId: string, id: string, dto: VersionDto) {
    return this.prisma.$transaction(async (tx) => {
      const d = await this.findOwned(userId, id, tx);
      if (d.status === 'PENDING_REVIEW') return this.mapSeller(d);
      if (!['DRAFT', 'REJECTED'].includes(d.status))
        throw this.err('LISTING_DRAFT_STATUS_CONFLICT', 409);
      if (d.version !== dto.expectedVersion)
        throw this.versionConflict(d, 'Recarregue o rascunho antes de enviar.');
      await this.validateTaxonomy(tx, d, true);
      this.validateSubmit(d);
      const updated = await tx.listingDraft.updateMany({
        where: { id, version: dto.expectedVersion, status: { in: ['DRAFT', 'REJECTED'] } },
        data: {
          status: 'PENDING_REVIEW',
          submittedAt: new Date(),
          reviewStartedAt: null,
          reviewedAt: null,
          rejectionCode: null,
          rejectionReason: null,
          approvedAt: null,
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) {
        const current = await this.findOwned(userId, id, tx);
        if (current.status === 'PENDING_REVIEW') return this.mapSeller(current);
        if (!['DRAFT', 'REJECTED'].includes(current.status))
          throw this.err('LISTING_DRAFT_STATUS_CONFLICT', 409);
        throw this.versionConflict(current, 'Recarregue o rascunho antes de enviar.');
      }
      await tx.listingDraft.update({
        where: { id },
        data: { reviewedBy: { disconnect: true } },
      });
      await this.audit(tx, userId, SecurityEventType.LISTING_DRAFT_SUBMITTED, {
        draftId: id,
        sellerProfileId: d.sellerProfileId,
        statusOld: d.status,
        statusNew: 'PENDING_REVIEW',
        versionOld: d.version,
        versionNew: d.version + 1,
      });
      return this.mapSeller(await this.findFull(tx, id));
    });
  }
  async startReview(adminId: string, id: string, dto: VersionDto) {
    return this.adminTransition(
      adminId,
      id,
      dto,
      SecurityEventType.LISTING_DRAFT_REVIEW_STARTED,
      'UNDER_REVIEW',
      { reviewStartedAt: new Date() },
    );
  }
  async approve(adminId: string, id: string, dto: VersionDto) {
    return this.adminTransition(
      adminId,
      id,
      dto,
      SecurityEventType.LISTING_DRAFT_APPROVED,
      'APPROVED',
      { approvedAt: new Date(), reviewedAt: new Date() },
    );
  }
  async reject(adminId: string, id: string, dto: RejectDraftDto) {
    if (!rejectCodes.has(dto.rejectionCode)) throw this.err('LISTING_REJECTION_CODE_INVALID');
    const reason = this.text(dto.rejectionReason, 1000);
    if (!reason || reason.length < 5) throw this.err('LISTING_REJECTION_REASON_INVALID');
    return this.adminTransition(
      adminId,
      id,
      dto,
      SecurityEventType.LISTING_DRAFT_REJECTED,
      'REJECTED',
      {
        rejectionCode: dto.rejectionCode,
        rejectionReason: reason,
        reviewedAt: new Date(),
        approvedAt: null,
      },
    );
  }
  private async adminTransition(
    adminId: string,
    id: string,
    dto: VersionDto,
    type: SecurityEventType,
    status: ListingDraftStatus,
    data: DraftUpdateData,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const d = await tx.listingDraft.findUnique({ where: { id }, include });
      if (!d) throw new NotFoundException({ code: 'LISTING_DRAFT_NOT_FOUND' });
      if (d.status === status) return this.mapAdmin(d);
      if (!['PENDING_REVIEW', 'UNDER_REVIEW'].includes(d.status))
        throw this.err('LISTING_DRAFT_STATUS_CONFLICT', 409);
      if (d.version !== dto.expectedVersion)
        throw this.versionConflict(d, 'Recarregue o rascunho antes da moderação.');
      if (status === 'APPROVED') {
        if (!d.sellerProfile || d.sellerProfile.status !== SellerProfileStatus.ACTIVE)
          throw this.err('SELLER_PROFILE_ACTIVE_REQUIRED', HttpStatus.CONFLICT);
        await this.validateTaxonomy(tx, d, true);
        this.validateSubmit(d);
      }
      const updated = await tx.listingDraft.updateMany({
        where: {
          id,
          version: dto.expectedVersion,
          status: { in: ['PENDING_REVIEW', 'UNDER_REVIEW'] },
        },
        data: { ...data, status, version: { increment: 1 } },
      });
      if (updated.count !== 1) {
        const current = await this.findFull(tx, id);
        if (current.status === status) return this.mapAdmin(current);
        if (!['PENDING_REVIEW', 'UNDER_REVIEW'].includes(current.status))
          throw this.err('LISTING_DRAFT_STATUS_CONFLICT', 409);
        throw this.versionConflict(current, 'Recarregue o rascunho antes da moderação.');
      }
      await tx.listingDraft.update({
        where: { id },
        data: { reviewedBy: { connect: { id: adminId } } },
      });
      await this.audit(tx, adminId, type, {
        draftId: id,
        sellerProfileId: d.sellerProfileId,
        statusOld: d.status,
        statusNew: status,
        versionOld: d.version,
        versionNew: d.version + 1,
        rejectionCode: data.rejectionCode,
      });
      return this.mapAdmin(await this.findFull(tx, id));
    });
  }
}
