/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unnecessary-type-assertion */
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CatalogAttributeInputType,
  CatalogProductType,
  Prisma,
  SecurityEventOutcome,
  SecurityEventType,
} from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { API_PRODUCT_TYPE, INPUT_TYPE_API, PRODUCT_TYPE_API } from './catalog.constants';
import {
  normalizeColor,
  normalizeDescription,
  normalizeIcon,
  normalizeKey,
  normalizeName,
  normalizeOptions,
  normalizeOrder,
  normalizeSlug,
} from './catalog.validation';
import type {
  AttributeDto,
  CategoryDto,
  SubcategoryDto,
  UpdateAttributeDto,
  UpdateCategoryDto,
  UpdateSubcategoryDto,
} from './dto';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}
  categorySelect = {
    id: true,
    slug: true,
    name: true,
    description: true,
    iconKey: true,
    colorHex: true,
    featured: true,
    sortOrder: true,
    status: true,
  } as const;
  publicCategory(c: any) {
    const { status, ...r } = c;
    void status;
    return r;
  }
  async publicCategories() {
    const items = await this.prisma.catalogCategory.findMany({
      where: { status: 'ACTIVE' },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }],
      select: this.categorySelect,
    });
    return { items: items.map((c) => this.publicCategory(c)) };
  }
  async publicCategoryBySlug(slug: string) {
    const c = await this.prisma.catalogCategory.findFirst({
      where: { slug: normalizeSlug(slug), status: 'ACTIVE' },
      select: this.categorySelect,
    });
    if (!c) throw new NotFoundException({ code: 'CATALOG_CATEGORY_NOT_FOUND' });
    return this.publicCategory(c);
  }
  async publicSubcategories(categorySlug: string) {
    const c = await this.prisma.catalogCategory.findFirst({
      where: { slug: normalizeSlug(categorySlug), status: 'ACTIVE' },
      select: { id: true },
    });
    if (!c) throw new NotFoundException({ code: 'CATALOG_CATEGORY_NOT_FOUND' });
    const items = await this.prisma.catalogSubcategory.findMany({
      where: { categoryId: c.id, status: 'ACTIVE' },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }],
      select: { id: true, slug: true, name: true, categoryId: true, sortOrder: true },
    });
    return { items };
  }
  productTypes() {
    return { items: Object.values(CatalogProductType).map((t) => PRODUCT_TYPE_API[t]) };
  }
  toProductType(v?: string) {
    if (!v) return undefined;
    const t = API_PRODUCT_TYPE[v];
    if (!t) throw new BadRequestException({ code: 'CATALOG_PRODUCT_TYPE_INVALID' });
    return t;
  }
  attr(a: any) {
    return {
      key: a.key,
      label: a.label,
      inputType: INPUT_TYPE_API[a.inputType as CatalogAttributeInputType],
      placeholder: a.placeholder,
      required: a.required,
      options: a.selectOptions,
      sortOrder: a.sortOrder,
    };
  }
  async attributes(q: { categorySlug?: string; subcategorySlug?: string; productType?: string }) {
    const productType = this.toProductType(q.productType);
    let subcategoryId: string | undefined;
    if (q.subcategorySlug) {
      if (!q.categorySlug)
        throw new BadRequestException({ code: 'CATALOG_CATEGORY_FILTER_REQUIRED' });
      const cat = await this.prisma.catalogCategory.findFirst({
        where: { slug: normalizeSlug(q.categorySlug), status: 'ACTIVE' },
        select: { id: true },
      });
      if (!cat) throw new NotFoundException({ code: 'CATALOG_CATEGORY_NOT_FOUND' });
      const sub = await this.prisma.catalogSubcategory.findFirst({
        where: { categoryId: cat.id, slug: normalizeSlug(q.subcategorySlug), status: 'ACTIVE' },
        select: { id: true },
      });
      if (!sub) throw new NotFoundException({ code: 'CATALOG_SUBCATEGORY_NOT_FOUND' });
      subcategoryId = sub.id;
    }
    if (!productType && !subcategoryId)
      throw new BadRequestException({ code: 'CATALOG_ATTRIBUTE_FILTER_REQUIRED' });
    const [generic, specific] = await Promise.all([
      productType
        ? this.prisma.catalogAttribute.findMany({ where: { productType, status: 'ACTIVE' } })
        : [],
      subcategoryId
        ? this.prisma.catalogAttribute.findMany({ where: { subcategoryId, status: 'ACTIVE' } })
        : [],
    ]);
    const map = new Map<string, any>();
    for (const a of generic) map.set(a.key, a);
    for (const a of specific) map.set(a.key, a);
    const items = [...map.values()]
      .sort((a, b) => a.sortOrder - b.sortOrder || a.key.localeCompare(b.key))
      .map((a) => this.attr(a));
    return { items };
  }
  async adminCategories() {
    return {
      items: await this.prisma.catalogCategory.findMany({
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }],
        select: this.categorySelect,
      }),
    };
  }
  async adminSubcategories() {
    return {
      items: await this.prisma.catalogSubcategory.findMany({
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }],
      }),
    };
  }
  async adminAttributes() {
    return {
      items: await this.prisma.catalogAttribute.findMany({
        orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }, { id: 'asc' }],
      }),
    };
  }
  catData(dto: CategoryDto | UpdateCategoryDto) {
    const d: any = {};
    if (dto.slug !== undefined) d.slug = normalizeSlug(dto.slug);
    if (dto.name !== undefined) d.name = normalizeName(dto.name);
    if (dto.description !== undefined) d.description = normalizeDescription(dto.description);
    if (dto.iconKey !== undefined) d.iconKey = normalizeIcon(dto.iconKey);
    if (dto.colorHex !== undefined) d.colorHex = normalizeColor(dto.colorHex);
    if (dto.sortOrder !== undefined) d.sortOrder = normalizeOrder(dto.sortOrder);
    if (dto.featured !== undefined) d.featured = dto.featured;
    if (dto.status !== undefined) d.status = dto.status;
    return d;
  }
  subData(dto: SubcategoryDto | UpdateSubcategoryDto) {
    const d: any = {};
    if (dto.categoryId !== undefined) d.categoryId = dto.categoryId;
    if (dto.slug !== undefined) d.slug = normalizeSlug(dto.slug);
    if (dto.name !== undefined) d.name = normalizeName(dto.name);
    if (dto.sortOrder !== undefined) d.sortOrder = normalizeOrder(dto.sortOrder);
    if (dto.status !== undefined) d.status = dto.status;
    return d;
  }
  attrData(dto: AttributeDto | UpdateAttributeDto) {
    const d: any = {};
    if (dto.subcategoryId !== undefined) d.subcategoryId = dto.subcategoryId;
    if (dto.productType !== undefined) d.productType = this.toProductType(dto.productType);
    if (dto.key !== undefined) d.key = normalizeKey(dto.key);
    if (dto.label !== undefined) d.label = normalizeName(dto.label);
    if (dto.inputType !== undefined) d.inputType = dto.inputType;
    if (dto.placeholder !== undefined) d.placeholder = normalizeDescription(dto.placeholder);
    if (dto.required !== undefined) d.required = dto.required;
    if (dto.sortOrder !== undefined) d.sortOrder = normalizeOrder(dto.sortOrder);
    if (dto.status !== undefined) d.status = dto.status;
    if (dto.selectOptions !== undefined || dto.inputType !== undefined)
      d.selectOptions = normalizeOptions(
        dto.inputType ?? CatalogAttributeInputType.TEXT,
        dto.selectOptions,
      );
    if ('subcategoryId' in d && 'productType' in d ? !!d.subcategoryId === !!d.productType : false)
      throw new BadRequestException({ code: 'CATALOG_ATTRIBUTE_SCOPE_INVALID' });
    return d;
  }
  async audit(
    tx: Prisma.TransactionClient,
    userId: string,
    eventType: SecurityEventType,
    metadata: any,
  ) {
    await tx.securityEvent.create({
      data: { userId, eventType, outcome: SecurityEventOutcome.SUCCESS, metadata },
    });
  }
  conflict(e: any, code: string) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')
      throw new ConflictException({ code });
    throw e;
  }
  async createCategory(dto: CategoryDto, userId: string) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const item = await tx.catalogCategory.create({ data: this.catData(dto) });
        await this.audit(tx, userId, 'CATALOG_CATEGORY_CREATED' as SecurityEventType, {
          entityId: item.id,
          entityType: 'category',
          slug: item.slug,
        });
        return item;
      });
    } catch (e) {
      this.conflict(e, 'CATALOG_CATEGORY_SLUG_CONFLICT');
    }
  }
  async updateCategory(id: string, dto: UpdateCategoryDto, userId: string) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const before = await tx.catalogCategory.findUniqueOrThrow({ where: { id } });
        const item = await tx.catalogCategory.update({ where: { id }, data: this.catData(dto) });
        await this.audit(
          tx,
          userId,
          before.status !== item.status
            ? ('CATALOG_CATEGORY_STATUS_CHANGED' as SecurityEventType)
            : ('CATALOG_CATEGORY_UPDATED' as SecurityEventType),
          {
            entityId: id,
            entityType: 'category',
            slug: item.slug,
            previousStatus: before.status,
            newStatus: item.status,
            fields: Object.keys(dto),
          },
        );
        return item;
      });
    } catch (e) {
      this.conflict(e, 'CATALOG_CATEGORY_SLUG_CONFLICT');
    }
  }
  async createSubcategory(dto: SubcategoryDto, userId: string) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const item = await tx.catalogSubcategory.create({ data: this.subData(dto) });
        await this.audit(tx, userId, 'CATALOG_SUBCATEGORY_CREATED' as SecurityEventType, {
          entityId: item.id,
          entityType: 'subcategory',
          slug: item.slug,
        });
        return item;
      });
    } catch (e) {
      this.conflict(e, 'CATALOG_SUBCATEGORY_SLUG_CONFLICT');
    }
  }
  async updateSubcategory(id: string, dto: UpdateSubcategoryDto, userId: string) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const before = await tx.catalogSubcategory.findUniqueOrThrow({ where: { id } });
        const item = await tx.catalogSubcategory.update({ where: { id }, data: this.subData(dto) });
        await this.audit(
          tx,
          userId,
          before.status !== item.status
            ? ('CATALOG_SUBCATEGORY_STATUS_CHANGED' as SecurityEventType)
            : ('CATALOG_SUBCATEGORY_UPDATED' as SecurityEventType),
          {
            entityId: id,
            entityType: 'subcategory',
            slug: item.slug,
            previousStatus: before.status,
            newStatus: item.status,
            fields: Object.keys(dto),
          },
        );
        return item;
      });
    } catch (e) {
      this.conflict(e, 'CATALOG_SUBCATEGORY_SLUG_CONFLICT');
    }
  }
  async createAttribute(dto: AttributeDto, userId: string) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const item = await tx.catalogAttribute.create({ data: this.attrData(dto) });
        await this.audit(tx, userId, 'CATALOG_ATTRIBUTE_CREATED' as SecurityEventType, {
          entityId: item.id,
          entityType: 'attribute',
          key: item.key,
        });
        return item;
      });
    } catch (e) {
      this.conflict(e, 'CATALOG_ATTRIBUTE_KEY_CONFLICT');
    }
  }
  async updateAttribute(id: string, dto: UpdateAttributeDto, userId: string) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const before = await tx.catalogAttribute.findUniqueOrThrow({ where: { id } });
        const item = await tx.catalogAttribute.update({ where: { id }, data: this.attrData(dto) });
        await this.audit(
          tx,
          userId,
          before.status !== item.status
            ? ('CATALOG_ATTRIBUTE_STATUS_CHANGED' as SecurityEventType)
            : ('CATALOG_ATTRIBUTE_UPDATED' as SecurityEventType),
          {
            entityId: id,
            entityType: 'attribute',
            key: item.key,
            previousStatus: before.status,
            newStatus: item.status,
            fields: Object.keys(dto),
          },
        );
        return item;
      });
    } catch (e) {
      this.conflict(e, 'CATALOG_ATTRIBUTE_KEY_CONFLICT');
    }
  }
}
