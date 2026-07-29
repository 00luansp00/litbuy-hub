import { apiFetch, ApiError } from "@/lib/api/client";
import type { Category, ListingAttributeConfig, ListingProductType, Subcategory } from "@/types";
import {
  CatalogResponseValidationError,
  parsePublicCategoryListResponse,
  parsePublicCategoryResponse,
  parsePublicSubcategoryResponse,
  parsePublicSubcategoryListResponse,
} from "./catalog/publicTaxonomyParser";
export { CATALOG_ALLOWED_ICON_KEYS } from "./catalog/publicTaxonomyParser";
export type CatalogEntityStatus = "ACTIVE" | "INACTIVE";
export type CatalogProductTypeOption = { id: ListingProductType; name: string };
export type AdminCatalogCategory = Category & {
  status: CatalogEntityStatus;
  featured: boolean;
  sortOrder: number;
  iconKey?: string | null;
  colorHex?: string | null;
};
export type AdminCatalogSubcategory = Subcategory & {
  id: string;
  categoryId: string;
  status: CatalogEntityStatus;
  sortOrder: number;
};
export type AdminCatalogAttribute = ListingAttributeConfig & {
  id: string;
  subcategoryId?: string | null;
  productType?: ListingProductType | null;
  status: CatalogEntityStatus;
  sortOrder: number;
  inputType?: string;
  selectOptions?: string[];
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const types = [
  "account",
  "virtual_currency",
  "gift_card",
  "key",
  "skin",
  "item",
  "service",
  "subscription",
  "game",
  "software",
  "other",
] as const;
function normalizeProductType(v: string) {
  const lower = v.toLowerCase();
  if (types.includes(lower as never)) return lower as ListingProductType;
  if (v === "VIRTUAL_CURRENCY") return "virtual_currency";
  if (v === "GIFT_CARD") return "gift_card";
  const converted = v.toLowerCase() as ListingProductType;
  if (types.includes(converted as never)) return converted;
  invalid();
}
function normalizeInputType(v: string) {
  const lower = v.toLowerCase();
  if (["text", "number", "select", "boolean"].includes(lower))
    return lower as ListingAttributeConfig["type"];
  invalid();
}
function invalid(): never {
  throw new ApiError(502, "CATALOG_RESPONSE_INVALID", "Resposta inválida da API de catálogo.");
}
function obj(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) invalid();
  return v as Record<string, unknown>;
}
function str(v: unknown, re?: RegExp) {
  if (typeof v !== "string" || !v.trim() || (re && !re.test(v))) invalid();
  return v;
}
function optStr(v: unknown, re?: RegExp) {
  if (v == null || v === "") return undefined;
  return str(v, re);
}
function num(v: unknown) {
  if (typeof v !== "number" || !Number.isInteger(v) || Math.abs(v) > 100000) invalid();
  return v;
}
function bool(v: unknown) {
  if (typeof v !== "boolean") invalid();
  return v;
}
function items(v: unknown) {
  const o = obj(v);
  if (!Array.isArray(o.items)) invalid();
  return o.items;
}
function taxonomy<T>(parse: () => T): T {
  try {
    return parse();
  } catch (error) {
    if (error instanceof CatalogResponseValidationError) invalid();
    throw error;
  }
}
function adminCat(v: unknown): AdminCatalogCategory {
  const c = taxonomy(() => parsePublicCategoryResponse(v));
  const o = obj(v);
  const status = str(o.status) as CatalogEntityStatus;
  if (status !== "ACTIVE" && status !== "INACTIVE") invalid();
  return {
    ...c,
    status,
    featured: bool(o.featured),
    sortOrder: num(o.sortOrder),
    iconKey: c.icon,
    colorHex: c.color,
  };
}
function adminSub(v: unknown): AdminCatalogSubcategory {
  const s = taxonomy(() => parsePublicSubcategoryResponse(v));
  const o = obj(v);
  const status = str(o.status) as CatalogEntityStatus;
  if (status !== "ACTIVE" && status !== "INACTIVE") invalid();
  return { ...s, categoryId: str(o.categoryId, uuid), status, sortOrder: num(o.sortOrder) };
}
function parseOptions(type: ListingAttributeConfig["type"], raw: unknown) {
  const arr =
    raw == null
      ? []
      : Array.isArray(raw) && raw.every((x) => typeof x === "string" && x.trim())
        ? (raw as string[]).map((x) => x.trim())
        : invalid();
  if (arr.length > 30 || new Set(arr).size !== arr.length) invalid();
  if (type === "select" && arr.length === 0) invalid();
  if (type !== "select" && arr.length > 0) invalid();
  return arr;
}
function attr(v: unknown): ListingAttributeConfig {
  const o = obj(v);
  const type = normalizeInputType(str(o.inputType ?? o.type));
  const arr = parseOptions(type, o.options ?? o.selectOptions);
  return {
    key: str(o.key, /^[a-z][a-z0-9_]{1,59}$/),
    label: str(o.label),
    type,
    placeholder: optStr(o.placeholder),
    required: o.required == null ? undefined : bool(o.required),
    options: arr.length ? arr : undefined,
  };
}
function adminAttr(v: unknown): AdminCatalogAttribute {
  const a = attr(v);
  const o = obj(v);
  const status = str(o.status) as CatalogEntityStatus;
  if (status !== "ACTIVE" && status !== "INACTIVE") invalid();
  const subcategoryId = o.subcategoryId == null ? null : str(o.subcategoryId, uuid);
  const pt = o.productType == null ? null : normalizeProductType(str(o.productType));
  if ((subcategoryId == null) === (pt == null)) invalid();
  return {
    ...a,
    id: str(o.id, uuid),
    subcategoryId,
    productType: pt as ListingProductType | null,
    status,
    sortOrder: num(o.sortOrder),
    selectOptions: a.options,
    inputType: a.type,
  };
}
export const catalogService = {
  async getCategories() {
    const raw = await apiFetch("/catalog/categories", { auth: false });
    return taxonomy(() => parsePublicCategoryListResponse(raw));
  },
  async getCategoryBySlug(slug: string) {
    const raw = await apiFetch(`/catalog/categories/${encodeURIComponent(slug)}`, { auth: false });
    return taxonomy(() => parsePublicCategoryResponse(raw));
  },
  async getSubcategoriesByCategory(categorySlug: string) {
    const raw = await apiFetch(
      `/catalog/categories/${encodeURIComponent(categorySlug)}/subcategories`,
      { auth: false },
    );
    return taxonomy(() => parsePublicSubcategoryListResponse(raw));
  },
  async getProductTypes() {
    return items(await apiFetch("/catalog/product-types", { auth: false })).map((v) => {
      const o = obj(v);
      const id = normalizeProductType(str(o.id));
      return { id, name: str(o.name) };
    });
  },
  async getAttributesForSubcategory(
    categorySlug: string | undefined,
    subcategorySlug: string | undefined,
    productType: ListingProductType | undefined,
  ) {
    const q = new URLSearchParams();
    if (categorySlug) q.set("categorySlug", categorySlug);
    if (subcategorySlug) q.set("subcategorySlug", subcategorySlug);
    if (productType) q.set("productType", productType);
    return items(await apiFetch(`/catalog/attributes?${q}`, { auth: false })).map(attr);
  },
  admin: {
    categories: () => apiFetch("/admin/catalog/categories").then((r) => items(r).map(adminCat)),
    subcategories: () =>
      apiFetch("/admin/catalog/subcategories").then((r) => items(r).map(adminSub)),
    attributes: () => apiFetch("/admin/catalog/attributes").then((r) => items(r).map(adminAttr)),
    createCategory: (b: unknown) =>
      apiFetch("/admin/catalog/categories", { method: "POST", body: JSON.stringify(b) }).then(
        adminCat,
      ),
    updateCategory: (id: string, b: unknown) =>
      apiFetch(`/admin/catalog/categories/${id}`, {
        method: "PATCH",
        body: JSON.stringify(b),
      }).then(adminCat),
    createSubcategory: (b: unknown) =>
      apiFetch("/admin/catalog/subcategories", { method: "POST", body: JSON.stringify(b) }).then(
        adminSub,
      ),
    updateSubcategory: (id: string, b: unknown) =>
      apiFetch(`/admin/catalog/subcategories/${id}`, {
        method: "PATCH",
        body: JSON.stringify(b),
      }).then(adminSub),
    createAttribute: (b: unknown) =>
      apiFetch("/admin/catalog/attributes", { method: "POST", body: JSON.stringify(b) }).then(
        adminAttr,
      ),
    updateAttribute: (id: string, b: unknown) =>
      apiFetch(`/admin/catalog/attributes/${id}`, {
        method: "PATCH",
        body: JSON.stringify(b),
      }).then(adminAttr),
  },
};
export const categoryService = {
  list: catalogService.getCategories,
  bySlug: catalogService.getCategoryBySlug,
  getSubcategoriesByCategory: catalogService.getSubcategoriesByCategory,
};
