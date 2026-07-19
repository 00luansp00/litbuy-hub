/* eslint-disable */
import { ConflictException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import {
  CatalogAttributeInputType,
  CatalogEntityStatus,
  CatalogProductType,
  ListingDraftDeliveryMode,
  ListingDraftModel,
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
  private text(v: unknown, max = 5000) {
    if (v == null) return null;
    const s = String(v)
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (s.length > max) throw this.err('LISTING_TEXT_INVALID');
    return s || null;
  }
  private price(v: unknown) {
    if (v == null || v === '') return null;
    const s = String(v).trim();
    if (!/^(?:[1-9]\d{0,9}|0)\.\d{2}$/.test(s) && !/^[1-9]\d{0,9}$/.test(s))
      throw this.err('LISTING_PRICE_INVALID');
    const n = Number(s);
    if (!Number.isFinite(n) || n <= 0 || n > 9999999999) throw this.err('LISTING_PRICE_INVALID');
    return new Prisma.Decimal(s);
  }
  private productType(v?: string | null) {
    if (!v) return undefined;
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
  private async findOwned(userId: string, id: string, tx: any = this.prisma) {
    const p = await tx.sellerProfile.findUnique({ where: { userId } });
    if (!p) throw new NotFoundException({ code: 'LISTING_DRAFT_NOT_FOUND' });
    const d = await tx.listingDraft.findFirst({ where: { id, sellerProfileId: p.id }, include });
    if (!d) throw new NotFoundException({ code: 'LISTING_DRAFT_NOT_FOUND' });
    if (p.status !== SellerProfileStatus.ACTIVE)
      throw this.err('SELLER_PROFILE_ACTIVE_REQUIRED', HttpStatus.FORBIDDEN);
    return d;
  }
  private map(d: any) {
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
      productType: d.productType ? PRODUCT_TYPE_API[d.productType as CatalogProductType].id : null,
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
      variants: (d.variants ?? []).map((v: any) => ({
        id: v.id,
        title: v.title,
        description: v.description,
        price: v.price.toFixed(2),
        stock: v.stock,
        status: v.status,
        sortOrder: v.sortOrder,
      })),
      attributes: (d.attributes ?? []).map((a: any) => ({ key: a.key, value: a.value })),
      serviceDetails: d.serviceDetails
        ? { ...d.serviceDetails, basePrice: d.serviceDetails.basePrice?.toFixed(2) ?? null }
        : null,
      accountDetails: d.accountDetails ?? null,
      seller: d.sellerProfile
        ? {
            id: d.sellerProfile.id,
            storeName: d.sellerProfile.storeName,
            slug: d.sellerProfile.slug,
            status: d.sellerProfile.status,
            verified: d.sellerProfile.verified,
            userEmail: d.sellerProfile.user?.email,
          }
        : undefined,
      moderationNotice:
        d.status === 'APPROVED'
          ? 'Aprovado pela moderação. A publicação pública ainda não está disponível.'
          : undefined,
    };
  }
  private async audit(tx: any, userId: string | null, type: SecurityEventType, metadata: any) {
    await tx.securityEvent.create({
      data: { userId, eventType: type, outcome: SecurityEventOutcome.SUCCESS, metadata },
    });
  }
  private async validateTaxonomy(data: any, requireActive = false) {
    if (!data.categoryId) return [];
    const cat = await this.prisma.catalogCategory.findUnique({ where: { id: data.categoryId } });
    if (!cat) throw this.err('LISTING_CATEGORY_NOT_FOUND', 404);
    if (requireActive && cat.status !== CatalogEntityStatus.ACTIVE)
      throw this.err('LISTING_TAXONOMY_INACTIVE');
    if (data.subcategoryId) {
      const sub = await this.prisma.catalogSubcategory.findUnique({
        where: { id: data.subcategoryId },
      });
      if (!sub) throw this.err('LISTING_SUBCATEGORY_NOT_FOUND', 404);
      if (sub.categoryId !== data.categoryId) throw this.err('LISTING_SUBCATEGORY_NOT_FOUND', 404);
      if (requireActive && sub.status !== CatalogEntityStatus.ACTIVE)
        throw this.err('LISTING_TAXONOMY_INACTIVE');
    }
    const attrs = await this.prisma.catalogAttribute.findMany({
      where: {
        OR: [
          { productType: data.productType ?? undefined },
          { subcategoryId: data.subcategoryId ?? undefined },
        ],
        ...(requireActive ? { status: CatalogEntityStatus.ACTIVE } : {}),
      },
    });
    const map = new Map(attrs.map((a) => [a.key, a]));
    for (const a of data.attributes ?? []) {
      const cfg = map.get(a.key);
      if (!cfg) throw this.err('LISTING_ATTRIBUTE_UNKNOWN');
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
        if (cfg.required && !(data.attributes ?? []).some((a: any) => a.key === cfg.key && a.value))
          throw this.err('LISTING_REQUIRED_ATTRIBUTE_MISSING');
  }
  private validateSubmit(d: any) {
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
        !d.variants.some((v: any) => v.status === ListingDraftVariantStatus.ACTIVE && v.stock > 0))
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
  private async dataFromDto(dto: CreateDraftDto | UpdateDraftDto) {
    const data: any = {};
    for (const k of [
      'model',
      'categoryId',
      'subcategoryId',
      'deliveryMode',
      'requestedPromotionTier',
      'requestedSellerPlan',
      'notifyInApp',
      'notifyBrowser',
      'notifyEmailFuture',
      'notifyExternalFuture',
      'wizardStep',
    ] as const)
      if (k in dto) data[k] = (dto as any)[k];
    if ('productType' in dto) data.productType = this.productType(dto.productType);
    for (const k of ['title', 'description', 'autoMessage'] as const)
      if (k in dto)
        data[k] = this.text(
          (dto as any)[k],
          k === 'title' ? 140 : k === 'autoMessage' ? 1000 : 5000,
        );
    if ('price' in dto) data.price = this.price(dto.price);
    if ('stock' in dto) data.stock = dto.stock;
    return data;
  }
  async create(userId: string, dto: CreateDraftDto) {
    const p = await this.sellerProfile(userId);
    const data = await this.dataFromDto(dto);
    await this.validateTaxonomy({ ...data, attributes: dto.attributes ?? [] });
    return this.prisma.$transaction(async (tx) => {
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
          data: {
            ...dto.serviceDetails,
            basePrice: this.price(dto.serviceDetails.basePrice),
            draftId: d.id,
          },
        });
      if (dto.accountDetails)
        await tx.listingDraftAccountDetails.create({
          data: { ...dto.accountDetails, draftId: d.id },
        });
      await this.audit(tx, userId, SecurityEventType.LISTING_DRAFT_CREATED, {
        draftId: d.id,
        sellerProfileId: p.id,
        statusNew: d.status,
        versionNew: d.version,
      });
      return this.get(userId, d.id);
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
  private async listWhere(where: any, q: any) {
    const limit = Math.min(q.limit ?? 20, 50);
    const items = await this.prisma.listingDraft.findMany({
      where: {
        ...where,
        ...(q.status ? { status: q.status } : {}),
        ...(q.search ? { title: { contains: q.search, mode: 'insensitive' } } : {}),
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      include,
    });
    const page = items.slice(0, limit).map((d) => this.map(d));
    return { items: page, nextCursor: items.length > limit ? page.at(-1)!.id : null };
  }
  async get(userId: string, id: string) {
    return this.map(await this.findOwned(userId, id));
  }
  async adminGet(id: string) {
    const d = await this.prisma.listingDraft.findUnique({ where: { id }, include });
    if (!d) throw new NotFoundException({ code: 'LISTING_DRAFT_NOT_FOUND' });
    return this.map(d);
  }
  private async replaceVariants(tx: any, draftId: string, variants: any[]) {
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
  async update(userId: string, id: string, dto: UpdateDraftDto) {
    return this.prisma.$transaction(async (tx) => {
      const d = await this.findOwned(userId, id, tx);
      if (!['DRAFT', 'REJECTED'].includes(d.status))
        throw this.err('LISTING_DRAFT_NOT_EDITABLE', 409);
      if (d.version !== dto.expectedVersion)
        throw new ConflictException({
          code: 'LISTING_DRAFT_VERSION_CONFLICT',
          currentVersion: d.version,
          updatedAt: d.updatedAt.toISOString(),
          message: 'Recarregue o rascunho antes de salvar.',
        });
      const data = await this.dataFromDto(dto);
      await this.validateTaxonomy({ ...d, ...data, attributes: dto.attributes ?? d.attributes });
      const next = await tx.listingDraft.update({
        where: { id },
        data: { ...data, version: { increment: 1 } },
        include,
      });
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
            data: {
              ...dto.serviceDetails,
              basePrice: this.price(dto.serviceDetails.basePrice),
              draftId: id,
            },
          });
      }
      if ('accountDetails' in dto) {
        await tx.listingDraftAccountDetails.deleteMany({ where: { draftId: id } });
        if (dto.accountDetails)
          await tx.listingDraftAccountDetails.create({
            data: { ...dto.accountDetails, draftId: id },
          });
      }
      await this.audit(tx, userId, SecurityEventType.LISTING_DRAFT_UPDATED, {
        draftId: id,
        sellerProfileId: d.sellerProfileId,
        statusOld: d.status,
        statusNew: next.status,
        versionOld: d.version,
        versionNew: next.version,
      });
      return this.adminGet(id);
    });
  }
  async submit(userId: string, id: string, dto: VersionDto) {
    return this.prisma.$transaction(async (tx) => {
      const d = await this.findOwned(userId, id, tx);
      if (d.status === 'PENDING_REVIEW') return this.map(d);
      if (!['DRAFT', 'REJECTED'].includes(d.status))
        throw this.err('LISTING_DRAFT_STATUS_CONFLICT', 409);
      if (d.version !== dto.expectedVersion)
        throw new ConflictException({
          code: 'LISTING_DRAFT_VERSION_CONFLICT',
          currentVersion: d.version,
          updatedAt: d.updatedAt.toISOString(),
          message: 'Recarregue o rascunho antes de enviar.',
        });
      await this.validateTaxonomy(d, true);
      this.validateSubmit(d);
      const next = await tx.listingDraft.update({
        where: { id },
        data: {
          status: 'PENDING_REVIEW',
          submittedAt: new Date(),
          reviewStartedAt: null,
          reviewedAt: null,
          reviewedByUserId: null,
          rejectionCode: null,
          rejectionReason: null,
          approvedAt: null,
          version: { increment: 1 },
        },
        include,
      });
      await this.audit(tx, userId, SecurityEventType.LISTING_DRAFT_SUBMITTED, {
        draftId: id,
        sellerProfileId: d.sellerProfileId,
        statusOld: d.status,
        statusNew: next.status,
        versionOld: d.version,
        versionNew: next.version,
      });
      return this.map(next);
    });
  }
  async startReview(adminId: string, id: string, dto: VersionDto) {
    return this.adminTransition(
      adminId,
      id,
      dto,
      SecurityEventType.LISTING_DRAFT_REVIEW_STARTED,
      'UNDER_REVIEW',
      { reviewStartedAt: new Date(), reviewedByUserId: adminId },
    );
  }
  async approve(adminId: string, id: string, dto: VersionDto) {
    const d = await this.prisma.listingDraft.findUnique({ where: { id }, include });
    if (d) {
      await this.validateTaxonomy(d, true);
      this.validateSubmit(d);
    }
    return this.adminTransition(
      adminId,
      id,
      dto,
      SecurityEventType.LISTING_DRAFT_APPROVED,
      'APPROVED',
      { approvedAt: new Date(), reviewedAt: new Date(), reviewedByUserId: adminId },
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
        reviewedByUserId: adminId,
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
    data: any,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const d = await tx.listingDraft.findUnique({ where: { id }, include });
      if (!d) throw new NotFoundException({ code: 'LISTING_DRAFT_NOT_FOUND' });
      if (d.status === status) return this.map(d);
      if (!['PENDING_REVIEW', 'UNDER_REVIEW'].includes(d.status))
        throw this.err('LISTING_DRAFT_STATUS_CONFLICT', 409);
      if (d.version !== dto.expectedVersion)
        throw new ConflictException({
          code: 'LISTING_DRAFT_VERSION_CONFLICT',
          currentVersion: d.version,
          updatedAt: d.updatedAt.toISOString(),
          message: 'Recarregue o rascunho antes da moderação.',
        });
      const next = await tx.listingDraft.update({
        where: { id },
        data: { ...data, status, version: { increment: 1 } },
        include,
      });
      await this.audit(tx, adminId, type, {
        draftId: id,
        sellerProfileId: d.sellerProfileId,
        statusOld: d.status,
        statusNew: status,
        versionOld: d.version,
        versionNew: next.version,
        rejectionCode: data.rejectionCode,
      });
      return this.map(next);
    });
  }
}
