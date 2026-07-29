import { describe, expect, it, vi } from "vitest";
import { ApiError, setAccessToken } from "@/lib/api/client";
import {
  parsePublicCategoryResponse,
  parsePublicSubcategoryListResponse,
} from "./catalog/publicTaxonomyParser";
import { catalogService } from "./catalogService";

describe("catalogService parser", () => {
  const ok = {
    items: [
      {
        id: "00000000-0000-4000-8000-000000000001",
        slug: "contas",
        name: "Contas",
        description: "d",
        iconKey: "Gift",
        colorHex: "#8B5CF6",
        featured: true,
        sortOrder: 1,
      },
    ],
  };
  const category = ok.items[0];
  const subcategory = {
    id: "00000000-0000-4000-8000-000000000002",
    slug: "demo-contas",
    name: "Contas",
    categorySlug: "demo-jogos",
  };
  it("parses one valid public category response", () => {
    expect(parsePublicCategoryResponse(category)).toMatchObject({ slug: "contas", name: "Contas" });
  });
  it("rejects a malformed public category response", () => {
    expect(() => parsePublicCategoryResponse({ ...category, slug: "Bad Slug" })).toThrow(
      "INVALID_CATALOG_RESPONSE",
    );
  });
  it("parses a valid public subcategory list", () => {
    expect(parsePublicSubcategoryListResponse({ items: [subcategory] })).toEqual([
      expect.objectContaining({ slug: "demo-contas", categorySlug: "demo-jogos" }),
    ]);
  });
  it("rejects a malformed public subcategory item and root", () => {
    expect(() =>
      parsePublicSubcategoryListResponse({ items: [{ ...subcategory, slug: "Bad" }] }),
    ).toThrow("INVALID_CATALOG_RESPONSE");
    expect(() => parsePublicSubcategoryListResponse({ items: "invalid" })).toThrow(
      "INVALID_CATALOG_RESPONSE",
    );
  });
  it("uses public category endpoints without authentication", async () => {
    setAccessToken("must-not-be-sent");
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      return new Response(
        JSON.stringify(url.endsWith("/subcategories") ? { items: [subcategory] } : category),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    await catalogService.getCategoryBySlug("demo-jogos");
    await catalogService.getSubcategoriesByCategory("demo-jogos");
    expect(fetchMock.mock.calls.map(([input]) => String(input))).toEqual([
      expect.stringContaining("/catalog/categories/demo-jogos"),
      expect.stringContaining("/catalog/categories/demo-jogos/subcategories"),
    ]);
    expect(
      fetchMock.mock.calls.every(
        ([, init]) => !(init?.headers as Headers | undefined)?.has("Authorization"),
      ),
    ).toBe(true);
    setAccessToken(null);
  });
  it.each([
    ["category", () => catalogService.getCategoryBySlug("demo-jogos")],
    ["subcategories", () => catalogService.getSubcategoriesByCategory("demo-jogos")],
  ])("converts malformed public %s into the stable API error", async (_, request) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ invalid: true }), { status: 200 })),
    );
    await expect(request()).rejects.toMatchObject({
      status: 502,
      code: "CATALOG_RESPONSE_INVALID",
      message: "Resposta inválida da API de catálogo.",
    });
  });
  it("parses valid categories", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(ok), { status: 200 })),
    );
    await expect(catalogService.getCategories()).resolves.toMatchObject([
      { slug: "contas", icon: "Gift" },
    ]);
  });
  it.each([{ id: "bad" }, { slug: "Bad" }, { colorHex: "red" }, { iconKey: "Hack" }])(
    "rejects malformed category %#",
    async (patch) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(
          async () =>
            new Response(JSON.stringify({ items: [{ ...ok.items[0], ...patch }] }), {
              status: 200,
            }),
        ),
      );
      await expect(catalogService.getCategories()).rejects.toMatchObject({
        code: "CATALOG_RESPONSE_INVALID",
      } as ApiError);
    },
  );
  it("rejects malformed attributes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              items: [{ key: "elo", label: "Elo", inputType: "select", options: [] }],
            }),
            { status: 200 },
          ),
      ),
    );
    await expect(
      catalogService.getAttributesForSubcategory("contas", "valorant", "account"),
    ).rejects.toMatchObject({ code: "CATALOG_RESPONSE_INVALID" });
  });
  const adminAttr = {
    id: "00000000-0000-4000-8000-000000000111",
    subcategoryId: null,
    productType: "virtual_currency",
    key: "quantidade",
    label: "Quantidade",
    inputType: "number",
    placeholder: "0",
    required: false,
    options: [],
    sortOrder: 1,
    status: "ACTIVE",
  };
  it.each([
    { subcategoryId: null, productType: null },
    { subcategoryId: "00000000-0000-4000-8000-000000000111", productType: "account" },
    { key: "Bad Key" },
    { inputType: "select", options: [] },
    { inputType: "text", options: ["BR"] },
    { inputType: "select", options: ["BR", "BR"] },
    { inputType: "select", options: [""] },
    { inputType: "select", options: Array.from({ length: 31 }, (_, i) => `O${i}`) },
    { status: "DELETED" },
    { sortOrder: 1.5 },
    { subcategoryId: "not-uuid", productType: null },
    { productType: "unknown" },
  ])("rejects malformed admin attribute scope/options %#", async (patch) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ items: [{ ...adminAttr, ...patch }] }), { status: 200 }),
      ),
    );
    await expect(catalogService.admin.attributes()).rejects.toMatchObject({
      code: "CATALOG_RESPONSE_INVALID",
    });
  });
  it("parses admin attribute with explicit subcategory scope", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              items: [
                {
                  ...adminAttr,
                  subcategoryId: "00000000-0000-4000-8000-000000000222",
                  productType: null,
                  inputType: "select",
                  options: ["BR", "NA"],
                },
              ],
            }),
            { status: 200 },
          ),
      ),
    );
    await expect(catalogService.admin.attributes()).resolves.toMatchObject([
      { subcategoryId: "00000000-0000-4000-8000-000000000222", productType: null },
    ]);
  });
});
