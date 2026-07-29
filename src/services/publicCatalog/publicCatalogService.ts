import { apiFetch } from "@/lib/api/client";
import { parsePublicCatalogListResponse } from "./parser";
import type { PublicCatalogListParams } from "./types";

function positiveInteger(value: number): string {
  if (!Number.isInteger(value) || value < 1) throw new TypeError("INVALID_PUBLIC_CATALOG_QUERY");
  return String(value);
}

export const publicCatalogService = {
  async list(params: PublicCatalogListParams) {
    const search = new URLSearchParams({
      sort: params.sort,
      page: positiveInteger(params.page),
      limit: positiveInteger(params.limit),
    });
    const raw = await apiFetch<unknown>(`/catalog/products?${search.toString()}`, { auth: false });
    return parsePublicCatalogListResponse(raw);
  },
};
