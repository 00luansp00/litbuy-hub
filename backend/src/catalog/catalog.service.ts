import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CatalogAttributeInputType,
  CatalogEntityStatus,
  CatalogProductType,
  Prisma,
  SecurityEventOutcome,
  SecurityEventType,
} from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { API_PRODUCT_TYPE, INPUT_TYPE_API, PRODUCT_TYPE_API } from './catalog.constants';
import {
  normalizeCatalogSlugFormat,
  normalizeColor,
  normalizeDescription,
  normalizeIcon,
  normalizeKey,
  normalizeName,
  normalizeOptions,
  normalizeOrder,
  validateNewCatalogSlug,
} from './catalog.validation';
import type {
  AttributeDto,
  CategoryDto,
  SubcategoryDto,
  UpdateAttributeDto,
  UpdateCategoryDto,
  UpdateSubcategoryDto,
} from './dto';

type CatalogCategoryRow = Prisma.CatalogCategoryGetPayload<{ select: typeof categorySelect }>;
type CatalogSubcategoryRow = Prisma.CatalogSubcategoryGetPayload<Record<string, never>>;
type CatalogAttributeRow = Prisma.CatalogAttributeGetPayload<Record<string, never>>;
type AuditMetadata = Record<string, string | string[] | number | boolean | null>;
type PublicCategory = Omit<CatalogCategoryRow, 'status'>;
type PublicSubcategory = { id: string; slug: string; name: string; sortOrder: number };
type PublicAttribute = {
  key: string;
  label: string;
  inputType: 'text' | 'number' | 'select' | 'boolean';
  placeholder: string | null;
  required: boolean;
  options: string[];
  sortOrder: number;
};
type AdminAttribute = PublicAttribute & {
  id: string;
  subcategoryId: string | null;
  productType: string | null;
  status: CatalogEntityStatus;
};
type NormalizedAttributePatch = {
  subcategoryId?: string | null;
  productType?: CatalogProductType | null;
  key?: string;
  label?: string;
  inputType?: CatalogAttributeInputType;
  placeholder?: string | null;
  required?: boolean;
  selectOptions?: string[];
  sortOrder?: number;
  status?: CatalogEntityStatus;
};

const categorySelect = {
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

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  publicCategory(c: CatalogCategoryRow): PublicCategory {
    const { status, ...rest } = c;
    void status;
    return rest;
  }

  attributeResponse(a: CatalogAttributeRow): PublicAttribute {
    return {
      key: a.key,
      label: a.label,
      inputType: INPUT_TYPE_API[a.inputType],
      placeholder: a.placeholder,
      required: a.required,
      options: a.selectOptions,
      sortOrder: a.sortOrder,
    };
  }

  adminAttributeResponse(a: CatalogAttributeRow): AdminAttribute {
    return {
      id: a.id,
      subcategoryId: a.subcategoryId,
      productType: a.productType ? PRODUCT_TYPE_API[a.productType].id : null,
      ...this.attributeResponse(a),
      status: a.status,
    };
  }

  async publicCategories(): Promise<{ items: PublicCategory[] }> {
    const items = await this.prisma.catalogCategory.findMany({
      where: { status: 'ACTIVE' },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }],
      select: categorySelect,
    });
    return { items: items.map((c) => this.publicCategory(c)) };
  }

  async publicCategoryBySlug(slug: string): Promise<PublicCategory> {
    const c = await this.prisma.catalogCategory.findFirst({
      where: { slug: normalizeCatalogSlugFormat(slug), status: 'ACTIVE' },
      select: categorySelect,
    });
    if (!c) throw new NotFoundException({ code: 'CATALOG_CATEGORY_NOT_FOUND' });
    return this.publicCategory(c);
  }

  publicSubcategory(s: CatalogSubcategoryRow): PublicSubcategory {
    return { id: s.id, slug: s.slug, name: s.name, sortOrder: s.sortOrder };
  }

  async publicSubcategories(categorySlug: string): Promise<{ items: PublicSubcategory[] }> {
    const c = await this.prisma.catalogCategory.findFirst({
      where: { slug: normalizeCatalogSlugFormat(categorySlug), status: 'ACTIVE' },
      select: { id: true },
    });
    if (!c) throw new NotFoundException({ code: 'CATALOG_CATEGORY_NOT_FOUND' });
    const items = await this.prisma.catalogSubcategory.findMany({
      where: { categoryId: c.id, status: 'ACTIVE' },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }],
    });
    return { items: items.map((s) => this.publicSubcategory(s)) };
  }

  productTypes(): { items: { id: string; name: string }[] } {
    return { items: Object.values(CatalogProductType).map((t) => PRODUCT_TYPE_API[t]) };
  }

  toProductType(v?: string | null): CatalogProductType | undefined {
    if (v == null || v === '') return undefined;
    const upper = v.toUpperCase() as CatalogProductType;
    const t = API_PRODUCT_TYPE[v] ?? (CatalogProductType[upper] ? upper : undefined);
    if (!t) throw new BadRequestException({ code: 'CATALOG_PRODUCT_TYPE_INVALID' });
    return t;
  }

  toInputType(v?: string | null): CatalogAttributeInputType | undefined {
    if (v == null || v === '') return undefined;
    const normalized = v.toUpperCase() as CatalogAttributeInputType;
    if (!CatalogAttributeInputType[normalized])
      throw new BadRequestException({ code: 'CATALOG_ATTRIBUTE_INPUT_TYPE_INVALID' });
    return normalized;
  }

  async attributes(q: {
    categorySlug?: string;
    subcategorySlug?: string;
    productType?: string;
  }): Promise<{ items: PublicAttribute[] }> {
    const productType = this.toProductType(q.productType);
    let subcategoryId: string | undefined;
    if (q.subcategorySlug) {
      if (!q.categorySlug)
        throw new BadRequestException({ code: 'CATALOG_CATEGORY_FILTER_REQUIRED' });
      const cat = await this.prisma.catalogCategory.findFirst({
        where: { slug: normalizeCatalogSlugFormat(q.categorySlug), status: 'ACTIVE' },
        select: { id: true },
      });
      if (!cat) throw new NotFoundException({ code: 'CATALOG_CATEGORY_NOT_FOUND' });
      const sub = await this.prisma.catalogSubcategory.findFirst({
        where: {
          categoryId: cat.id,
          slug: normalizeCatalogSlugFormat(q.subcategorySlug),
          status: 'ACTIVE',
        },
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
        : Promise.resolve([] as CatalogAttributeRow[]),
      subcategoryId
        ? this.prisma.catalogAttribute.findMany({ where: { subcategoryId, status: 'ACTIVE' } })
        : Promise.resolve([] as CatalogAttributeRow[]),
    ]);
    const merged = new Map<string, CatalogAttributeRow>();
    for (const a of generic) merged.set(a.key, a);
    for (const a of specific) merged.set(a.key, a);
    const items = [...merged.values()]
      .sort((a, b) => a.sortOrder - b.sortOrder || a.key.localeCompare(b.key))
      .map((a) => this.attributeResponse(a));
    return { items };
  }

  async adminCategories(): Promise<{ items: CatalogCategoryRow[] }> {
    return {
      items: await this.prisma.catalogCategory.findMany({
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }],
        select: categorySelect,
      }),
    };
  }

  async adminSubcategories(): Promise<{ items: CatalogSubcategoryRow[] }> {
    return {
      items: await this.prisma.catalogSubcategory.findMany({
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }],
      }),
    };
  }

  async adminAttributes(): Promise<{ items: AdminAttribute[] }> {
    const items = await this.prisma.catalogAttribute.findMany({
      orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }, { id: 'asc' }],
    });
    return { items: items.map((a) => this.adminAttributeResponse(a)) };
  }

  ensureNonEmpty(dto: object): void {
    if (Object.values(dto).every((value) => value === undefined))
      throw new BadRequestException({ code: 'CATALOG_UPDATE_EMPTY' });
  }

  catData(dto: CategoryDto | UpdateCategoryDto): Prisma.CatalogCategoryCreateInput {
    const d: Prisma.CatalogCategoryCreateInput = {
      slug: dto.slug === undefined ? '' : validateNewCatalogSlug(dto.slug),
      name: dto.name === undefined ? '' : normalizeName(dto.name),
    };
    if (dto.description !== undefined) d.description = normalizeDescription(dto.description);
    if (dto.iconKey !== undefined) d.iconKey = normalizeIcon(dto.iconKey);
    if (dto.colorHex !== undefined) d.colorHex = normalizeColor(dto.colorHex);
    if (dto.sortOrder !== undefined) d.sortOrder = normalizeOrder(dto.sortOrder);
    if (dto.featured !== undefined) d.featured = dto.featured;
    if (dto.status !== undefined) d.status = dto.status;
    return d;
  }

  catPatch(dto: UpdateCategoryDto): Prisma.CatalogCategoryUpdateInput {
    const d: Prisma.CatalogCategoryUpdateInput = {};
    if (dto.slug !== undefined) d.slug = validateNewCatalogSlug(dto.slug);
    if (dto.name !== undefined) d.name = normalizeName(dto.name);
    if (dto.description !== undefined) d.description = normalizeDescription(dto.description);
    if (dto.iconKey !== undefined) d.iconKey = normalizeIcon(dto.iconKey);
    if (dto.colorHex !== undefined) d.colorHex = normalizeColor(dto.colorHex);
    if (dto.sortOrder !== undefined) d.sortOrder = normalizeOrder(dto.sortOrder);
    if (dto.featured !== undefined) d.featured = dto.featured;
    if (dto.status !== undefined) d.status = dto.status;
    return d;
  }

  subData(dto: SubcategoryDto): Prisma.CatalogSubcategoryUncheckedCreateInput {
    return {
      categoryId: dto.categoryId,
      slug: validateNewCatalogSlug(dto.slug),
      name: normalizeName(dto.name),
      sortOrder: normalizeOrder(dto.sortOrder),
      status: dto.status ?? CatalogEntityStatus.ACTIVE,
    };
  }

  subPatch(dto: UpdateSubcategoryDto): Prisma.CatalogSubcategoryUncheckedUpdateInput {
    const d: Prisma.CatalogSubcategoryUncheckedUpdateInput = {};
    if (dto.categoryId !== undefined) d.categoryId = dto.categoryId;
    if (dto.slug !== undefined) d.slug = validateNewCatalogSlug(dto.slug);
    if (dto.name !== undefined) d.name = normalizeName(dto.name);
    if (dto.sortOrder !== undefined) d.sortOrder = normalizeOrder(dto.sortOrder);
    if (dto.status !== undefined) d.status = dto.status;
    return d;
  }

  attrPatch(dto: AttributeDto | UpdateAttributeDto): NormalizedAttributePatch {
    const d: NormalizedAttributePatch = {};
    if (dto.subcategoryId !== undefined) d.subcategoryId = dto.subcategoryId;
    if (dto.productType !== undefined) d.productType = this.toProductType(dto.productType) ?? null;
    if (dto.key !== undefined) d.key = normalizeKey(dto.key);
    if (dto.label !== undefined) d.label = normalizeName(dto.label);
    if (dto.inputType !== undefined) d.inputType = this.toInputType(dto.inputType);
    if (dto.placeholder !== undefined) d.placeholder = normalizeDescription(dto.placeholder);
    if (dto.required !== undefined) d.required = dto.required;
    if (dto.sortOrder !== undefined) d.sortOrder = normalizeOrder(dto.sortOrder);
    if (dto.status !== undefined) d.status = dto.status;
    if (dto.selectOptions !== undefined) d.selectOptions = dto.selectOptions;
    return d;
  }

  async ensureAttributeEffectiveValid(
    tx: Prisma.TransactionClient,
    effective: Pick<
      CatalogAttributeRow,
      'subcategoryId' | 'productType' | 'inputType' | 'selectOptions' | 'key'
    >,
  ): Promise<void> {
    if (!!effective.subcategoryId === !!effective.productType)
      throw new BadRequestException({ code: 'CATALOG_ATTRIBUTE_SCOPE_INVALID' });
    normalizeKey(effective.key);
    normalizeOptions(effective.inputType, effective.selectOptions);
    if (effective.subcategoryId) {
      const sub = await tx.catalogSubcategory.findUnique({
        where: { id: effective.subcategoryId },
      });
      if (!sub) throw new NotFoundException({ code: 'CATALOG_SUBCATEGORY_NOT_FOUND' });
    }
  }

  attrCreateData(dto: AttributeDto): Prisma.CatalogAttributeUncheckedCreateInput {
    const patch = this.attrPatch(dto);
    const inputType = patch.inputType;
    if (!patch.key || !patch.label || !inputType)
      throw new BadRequestException({ code: 'CATALOG_ATTRIBUTE_INVALID' });
    if (!!patch.subcategoryId === !!patch.productType)
      throw new BadRequestException({ code: 'CATALOG_ATTRIBUTE_SCOPE_INVALID' });
    const selectOptions = normalizeOptions(inputType, patch.selectOptions);
    return {
      subcategoryId: patch.subcategoryId,
      productType: patch.productType,
      key: patch.key,
      label: patch.label,
      inputType,
      placeholder: patch.placeholder,
      required: patch.required ?? false,
      selectOptions,
      sortOrder: patch.sortOrder ?? 0,
      status: patch.status ?? CatalogEntityStatus.ACTIVE,
    };
  }

  attrUpdateData(
    patch: NormalizedAttributePatch,
    effective: CatalogAttributeRow,
  ): Prisma.CatalogAttributeUncheckedUpdateInput {
    const d: Prisma.CatalogAttributeUncheckedUpdateInput = {};
    if ('subcategoryId' in patch) d.subcategoryId = effective.subcategoryId;
    if ('productType' in patch) d.productType = effective.productType;
    if ('key' in patch) d.key = effective.key;
    if ('label' in patch) d.label = effective.label;
    if ('inputType' in patch) d.inputType = effective.inputType;
    if ('placeholder' in patch) d.placeholder = effective.placeholder;
    if ('required' in patch) d.required = effective.required;
    if ('selectOptions' in patch || 'inputType' in patch) d.selectOptions = effective.selectOptions;
    if ('sortOrder' in patch) d.sortOrder = effective.sortOrder;
    if ('status' in patch) d.status = effective.status;
    return d;
  }

  hasCategoryChanges(
    before: CatalogCategoryRow,
    patch: Prisma.CatalogCategoryUpdateInput,
  ): boolean {
    return Object.entries(patch).some(
      ([key, value]) => before[key as keyof CatalogCategoryRow] !== value,
    );
  }

  hasSubcategoryChanges(
    before: CatalogSubcategoryRow,
    patch: Prisma.CatalogSubcategoryUncheckedUpdateInput,
  ): boolean {
    return Object.entries(patch).some(
      ([key, value]) => before[key as keyof CatalogSubcategoryRow] !== value,
    );
  }

  hasAttributeChanges(
    before: CatalogAttributeRow,
    patch: Prisma.CatalogAttributeUncheckedUpdateInput,
  ): boolean {
    return Object.entries(patch).some(([key, value]) => {
      const beforeValue = before[key as keyof CatalogAttributeRow];
      return Array.isArray(beforeValue) && Array.isArray(value)
        ? beforeValue.join('\u0000') !== value.join('\u0000')
        : beforeValue !== value;
    });
  }

  async audit(
    tx: Prisma.TransactionClient,
    userId: string,
    eventType: SecurityEventType,
    metadata: AuditMetadata,
  ): Promise<void> {
    await tx.securityEvent.create({
      data: { userId, eventType, outcome: SecurityEventOutcome.SUCCESS, metadata },
    });
  }

  mapPrismaError(e: unknown, entity: 'category' | 'subcategory' | 'attribute'): never {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === 'P2002') {
        const code =
          entity === 'category'
            ? 'CATALOG_CATEGORY_SLUG_CONFLICT'
            : entity === 'subcategory'
              ? 'CATALOG_SUBCATEGORY_SLUG_CONFLICT'
              : 'CATALOG_ATTRIBUTE_KEY_CONFLICT';
        throw new ConflictException({ code });
      }
      if (e.code === 'P2003') {
        throw new NotFoundException({
          code:
            entity === 'subcategory'
              ? 'CATALOG_CATEGORY_NOT_FOUND'
              : 'CATALOG_SUBCATEGORY_NOT_FOUND',
        });
      }
      if (e.code === 'P2025') {
        const code =
          entity === 'category'
            ? 'CATALOG_CATEGORY_NOT_FOUND'
            : entity === 'subcategory'
              ? 'CATALOG_SUBCATEGORY_NOT_FOUND'
              : 'CATALOG_ATTRIBUTE_NOT_FOUND';
        throw new NotFoundException({ code });
      }
      if (e.code === 'P2004')
        throw new BadRequestException({ code: 'CATALOG_ATTRIBUTE_SCOPE_INVALID' });
    }
    throw e;
  }

  async createCategory(dto: CategoryDto, userId: string): Promise<CatalogCategoryRow> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const item = await tx.catalogCategory.create({
          data: this.catData(dto),
          select: categorySelect,
        });
        await this.audit(tx, userId, SecurityEventType.CATALOG_CATEGORY_CREATED, {
          entityId: item.id,
          entityType: 'category',
          slug: item.slug,
        });
        return item;
      });
    } catch (e) {
      this.mapPrismaError(e, 'category');
    }
  }

  async updateCategory(
    id: string,
    dto: UpdateCategoryDto,
    userId: string,
  ): Promise<CatalogCategoryRow> {
    this.ensureNonEmpty(dto);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const before = await tx.catalogCategory.findUniqueOrThrow({
          where: { id },
          select: categorySelect,
        });
        const patch = this.catPatch(dto);
        if (!this.hasCategoryChanges(before, patch)) return before;
        const item = await tx.catalogCategory.update({
          where: { id },
          data: patch,
          select: categorySelect,
        });
        await this.audit(
          tx,
          userId,
          before.status !== item.status
            ? SecurityEventType.CATALOG_CATEGORY_STATUS_CHANGED
            : SecurityEventType.CATALOG_CATEGORY_UPDATED,
          {
            entityId: id,
            entityType: 'category',
            slug: item.slug,
            previousStatus: before.status,
            newStatus: item.status,
            fields: Object.keys(patch),
          },
        );
        return item;
      });
    } catch (e) {
      this.mapPrismaError(e, 'category');
    }
  }

  async createSubcategory(dto: SubcategoryDto, userId: string): Promise<CatalogSubcategoryRow> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const item = await tx.catalogSubcategory.create({ data: this.subData(dto) });
        await this.audit(tx, userId, SecurityEventType.CATALOG_SUBCATEGORY_CREATED, {
          entityId: item.id,
          entityType: 'subcategory',
          slug: item.slug,
        });
        return item;
      });
    } catch (e) {
      this.mapPrismaError(e, 'subcategory');
    }
  }

  async updateSubcategory(
    id: string,
    dto: UpdateSubcategoryDto,
    userId: string,
  ): Promise<CatalogSubcategoryRow> {
    this.ensureNonEmpty(dto);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const before = await tx.catalogSubcategory.findUniqueOrThrow({ where: { id } });
        const patch = this.subPatch(dto);
        if (!this.hasSubcategoryChanges(before, patch)) return before;
        const item = await tx.catalogSubcategory.update({ where: { id }, data: patch });
        await this.audit(
          tx,
          userId,
          before.status !== item.status
            ? SecurityEventType.CATALOG_SUBCATEGORY_STATUS_CHANGED
            : SecurityEventType.CATALOG_SUBCATEGORY_UPDATED,
          {
            entityId: id,
            entityType: 'subcategory',
            slug: item.slug,
            previousStatus: before.status,
            newStatus: item.status,
            fields: Object.keys(patch),
          },
        );
        return item;
      });
    } catch (e) {
      this.mapPrismaError(e, 'subcategory');
    }
  }

  async createAttribute(dto: AttributeDto, userId: string): Promise<AdminAttribute> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const data = this.attrCreateData(dto);
        await this.ensureAttributeEffectiveValid(tx, {
          subcategoryId: data.subcategoryId ?? null,
          productType: data.productType ?? null,
          inputType: data.inputType,
          selectOptions: Array.isArray(data.selectOptions) ? data.selectOptions : [],
          key: data.key,
        });
        const item = await tx.catalogAttribute.create({ data });
        await this.audit(tx, userId, SecurityEventType.CATALOG_ATTRIBUTE_CREATED, {
          entityId: item.id,
          entityType: 'attribute',
          key: item.key,
        });
        return this.adminAttributeResponse(item);
      });
    } catch (e) {
      this.mapPrismaError(e, 'attribute');
    }
  }

  async updateAttribute(
    id: string,
    dto: UpdateAttributeDto,
    userId: string,
  ): Promise<AdminAttribute> {
    this.ensureNonEmpty(dto);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const before = await tx.catalogAttribute.findUniqueOrThrow({ where: { id } });
        const patch = this.attrPatch(dto);
        const effective: CatalogAttributeRow = {
          ...before,
          ...patch,
          inputType: patch.inputType ?? before.inputType,
          selectOptions: normalizeOptions(
            patch.inputType ?? before.inputType,
            patch.selectOptions ?? before.selectOptions,
          ),
        };
        await this.ensureAttributeEffectiveValid(tx, effective);
        const data = this.attrUpdateData(patch, effective);
        if (!this.hasAttributeChanges(before, data)) return this.adminAttributeResponse(before);
        const item = await tx.catalogAttribute.update({ where: { id }, data });
        await this.audit(
          tx,
          userId,
          before.status !== item.status
            ? SecurityEventType.CATALOG_ATTRIBUTE_STATUS_CHANGED
            : SecurityEventType.CATALOG_ATTRIBUTE_UPDATED,
          {
            entityId: id,
            entityType: 'attribute',
            key: item.key,
            previousStatus: before.status,
            newStatus: item.status,
            fields: Object.keys(data),
          },
        );
        return this.adminAttributeResponse(item);
      });
    } catch (e) {
      this.mapPrismaError(e, 'attribute');
    }
  }
}
