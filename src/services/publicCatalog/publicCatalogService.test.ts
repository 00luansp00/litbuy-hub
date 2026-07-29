import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiFetch } = vi.hoisted(() => ({ apiFetch: vi.fn() }));
vi.mock("@/lib/api/client", () => ({ apiFetch }));

import { MALFORMED_PUBLIC_CATALOG_RESPONSE, parsePublicCatalogListResponse } from "./parser";
import { publicCatalogService } from "./publicCatalogService";

const item = (overrides: Record<string, unknown> = {}) => ({
  id: "product-1",
  slug: "demo-product",
  title: "Produto demo",
  shortDescription: "Descrição pública",
  productType: "GAME",
  model: "NORMAL",
  pricing: { kind: "FIXED", amount: "49.90" },
  stock: 3,
  category: { slug: "jogos", name: "Jogos" },
  subcategory: { slug: "pc", name: "PC" },
  seller: { slug: "demo-store", storeName: "Demo Store" },
  coverImage: {
    url: "https://storage.local/signed-image?signature=secret",
    expiresAt: "2030-01-01T00:00:00.000Z",
    altText: null,
  },
  ...overrides,
});
const response = (
  product = item(),
  pagination: unknown = { page: 1, limit: 8, hasNext: false },
) => ({ items: [product], pagination });

beforeEach(() => vi.clearAllMocks());

describe("publicCatalogService", () => {
  it("calls the public endpoint with validated, safely encoded parameters and no auth", async () => {
    apiFetch.mockResolvedValue(response());
    await publicCatalogService.list({ sort: "RECENT", page: 1, limit: 8 });
    expect(apiFetch).toHaveBeenCalledWith("/catalog/products?sort=RECENT&page=1&limit=8", {
      auth: false,
    });
  });
  it("adds only defined category filters through URLSearchParams", async () => {
    apiFetch.mockResolvedValue(response());
    await publicCatalogService.list({
      categorySlug: "demo-jogos",
      subcategorySlug: "demo-servicos",
      productType: "SERVICE",
      sort: "TITLE_ASC",
      page: 2,
      limit: 12,
    });
    const path = apiFetch.mock.calls[0][0] as string;
    expect(path).toBe(
      "/catalog/products?categorySlug=demo-jogos&subcategorySlug=demo-servicos&productType=SERVICE&sort=TITLE_ASC&page=2&limit=12",
    );
    expect(Object.fromEntries(new URLSearchParams(path.split("?")[1]))).toEqual({
      categorySlug: "demo-jogos",
      subcategorySlug: "demo-servicos",
      productType: "SERVICE",
      sort: "TITLE_ASC",
      page: "2",
      limit: "12",
    });
  });
  it("omits optional filters", async () => {
    apiFetch.mockResolvedValue(response());
    await publicCatalogService.list({ sort: "OLDEST", page: 1, limit: 12 });
    expect(apiFetch.mock.calls[0][0]).not.toContain("categorySlug");
  });
  it.each([
    [{ sort: "UNKNOWN", page: 1, limit: 8 }],
    [{ sort: "RECENT", page: 0, limit: 8 }],
    [{ sort: "RECENT", page: 101, limit: 8 }],
    [{ sort: "RECENT", page: 1.5, limit: 8 }],
    [{ sort: "RECENT", page: Number.MAX_SAFE_INTEGER + 1, limit: 8 }],
    [{ sort: "RECENT", page: 1, limit: 0 }],
    [{ sort: "RECENT", page: 1, limit: 51 }],
    [{ sort: "RECENT", page: 1, limit: 1.5 }],
    [{ sort: "RECENT", page: 1, limit: 8, categorySlug: "" }],
    [{ sort: "RECENT", page: 1, limit: 8, categorySlug: "Demo" }],
    [{ sort: "RECENT", page: 1, limit: 8, subcategorySlug: "com espaço" }],
    [{ sort: "RECENT", page: 1, limit: 8, categorySlug: "demo--jogos" }],
    [{ sort: "RECENT", page: 1, limit: 8, categorySlug: "-demo" }],
    [{ sort: "RECENT", page: 1, limit: 8, categorySlug: "demo-" }],
    [{ sort: "RECENT", page: 1, limit: 8, categorySlug: "a".repeat(61) }],
    [{ sort: "RECENT", page: 1, limit: 8, productType: "UNKNOWN" }],
  ])("rejects an invalid query before constructing the URL", async (params) => {
    await expect(
      publicCatalogService.list(params as Parameters<typeof publicCatalogService.list>[0]),
    ).rejects.toThrow("INVALID_PUBLIC_CATALOG_QUERY");
    expect(apiFetch).not.toHaveBeenCalled();
  });
});

describe("public catalog parser", () => {
  it.each([
    [{ kind: "FIXED", amount: "49.90" }, 2, { slug: "pc", name: "PC" }],
    [{ kind: "FROM", amount: "9.90" }, null, null],
    [{ kind: "QUOTE", amount: null }, 0, null],
  ])(
    "parses pricing, stock, optional subcategory, image and pagination",
    (pricing, stock, subcategory) => {
      expect(
        parsePublicCatalogListResponse(
          response(
            item({
              pricing,
              stock,
              subcategory,
              model:
                pricing.kind === "FROM"
                  ? "DYNAMIC"
                  : pricing.kind === "QUOTE"
                    ? "SERVICE"
                    : "NORMAL",
            }),
          ),
        ),
      ).toMatchObject({
        items: [
          {
            pricing,
            stock,
            subcategory,
            coverImage: { url: expect.stringContaining("signed-image") },
          },
        ],
        pagination: { page: 1, limit: 8, hasNext: false },
      });
    },
  );
  it.each([
    [null],
    [{ items: "no", pagination: { page: 1, limit: 8, hasNext: false } }],
    [response(item({ pricing: { kind: "FIXED", amount: -1 } }))],
    [response(item({ pricing: { kind: "FROM", amount: "NaN" } }))],
    [response(item({ pricing: { kind: "QUOTE", amount: "0.00" } }))],
    [response(item({ model: "UNKNOWN" }))],
    [response(item({ productType: "UNKNOWN" }))],
    [response(item({ coverImage: { url: "", expiresAt: "2030-01-01", altText: null } }))],
    [response(item(), { page: 0, limit: 8, hasNext: false })],
  ])("rejects malformed responses without partial content", (raw) => {
    expect(() => parsePublicCatalogListResponse(raw)).toThrow(MALFORMED_PUBLIC_CATALOG_RESPONSE);
  });
  it.each([
    ["NORMAL", { kind: "FROM", amount: "9.90" }],
    ["NORMAL", { kind: "QUOTE", amount: null }],
    ["DYNAMIC", { kind: "FIXED", amount: "9.90" }],
    ["DYNAMIC", { kind: "QUOTE", amount: null }],
    ["SERVICE", { kind: "FROM", amount: "9.90" }],
  ])("rejects incoherent %s model and pricing combinations", (model, pricing) => {
    expect(() => parsePublicCatalogListResponse(response(item({ model, pricing })))).toThrow(
      MALFORMED_PUBLIC_CATALOG_RESPONSE,
    );
  });
});
