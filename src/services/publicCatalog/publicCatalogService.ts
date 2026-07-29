import { apiFetch } from "@/lib/api/client";
import { parsePublicCatalogListResponse } from "./parser";
import type { PublicCatalogListParams } from "./types";

const sorts = new Set(["RECENT", "OLDEST", "TITLE_ASC", "TITLE_DESC"]);
const productTypes = new Set([
  "ACCOUNT",
  "VIRTUAL_CURRENCY",
  "GIFT_CARD",
  "KEY",
  "SKIN",
  "ITEM",
  "SERVICE",
  "SUBSCRIPTION",
  "GAME",
  "SOFTWARE",
  "OTHER",
]);
const slugPattern = /^(?!.*--)[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?$/;

function optionalSlug(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !slugPattern.test(value))
    throw new TypeError("INVALID_PUBLIC_CATALOG_QUERY");
  return value;
}

function boundedInteger(value: number, maximum: number): string {
  if (!Number.isSafeInteger(value) || value < 1 || value > maximum)
    throw new TypeError("INVALID_PUBLIC_CATALOG_QUERY");
  return String(value);
}

export const publicCatalogService = {
  async list(params: PublicCatalogListParams) {
    if (!sorts.has(params.sort)) throw new TypeError("INVALID_PUBLIC_CATALOG_QUERY");
    if (params.productType !== undefined && !productTypes.has(params.productType))
      throw new TypeError("INVALID_PUBLIC_CATALOG_QUERY");
    const search = new URLSearchParams();
    const categorySlug = optionalSlug(params.categorySlug);
    const subcategorySlug = optionalSlug(params.subcategorySlug);
    if (categorySlug !== undefined) search.set("categorySlug", categorySlug);
    if (subcategorySlug !== undefined) search.set("subcategorySlug", subcategorySlug);
    if (params.productType !== undefined) search.set("productType", params.productType);
    search.set("sort", params.sort);
    search.set("page", boundedInteger(params.page, 100));
    search.set("limit", boundedInteger(params.limit, 50));
    const raw = await apiFetch<unknown>(`/catalog/products?${search.toString()}`, { auth: false });
    return parsePublicCatalogListResponse(raw);
  },
};
