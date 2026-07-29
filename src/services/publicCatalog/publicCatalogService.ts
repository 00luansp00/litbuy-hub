import { apiFetch } from "@/lib/api/client";
import { parsePublicCatalogListResponse } from "./parser";
import type { PublicCatalogListParams } from "./types";

const sorts = new Set(["RECENT", "OLDEST", "TITLE_ASC", "TITLE_DESC"]);

function boundedInteger(value: number, maximum: number): string {
  if (!Number.isSafeInteger(value) || value < 1 || value > maximum)
    throw new TypeError("INVALID_PUBLIC_CATALOG_QUERY");
  return String(value);
}

export const publicCatalogService = {
  async list(params: PublicCatalogListParams) {
    if (!sorts.has(params.sort)) throw new TypeError("INVALID_PUBLIC_CATALOG_QUERY");
    const search = new URLSearchParams({
      sort: params.sort,
      page: boundedInteger(params.page, 100),
      limit: boundedInteger(params.limit, 50),
    });
    const raw = await apiFetch<unknown>(`/catalog/products?${search.toString()}`, { auth: false });
    return parsePublicCatalogListResponse(raw);
  },
};
