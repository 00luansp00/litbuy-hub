import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiFetch } = vi.hoisted(() => ({ apiFetch: vi.fn() }));
vi.mock("@/lib/api/client", () => ({ apiFetch }));

import { MALFORMED_PUBLIC_CATALOG_RESPONSE, parsePublicCatalogDetailResponse } from "./parser";
import { publicCatalogService } from "./publicCatalogService";

const detail = (overrides: Record<string, unknown> = {}) => ({
  id: "p1",
  slug: "demo-product",
  title: "Produto",
  shortDescription: "Resumo",
  description: "Descrição real",
  productType: "GAME",
  model: "NORMAL",
  pricing: { kind: "FIXED", amount: "49.90" },
  stock: 10,
  category: { slug: "jogos", name: "Jogos" },
  subcategory: null,
  seller: { slug: "demo-store", storeName: "Demo Store" },
  deliveryMode: "MANUAL",
  variants: [],
  coverImage: {
    url: "https://storage.test/image?signature=secret",
    expiresAt: "2030-01-01T00:00:00Z",
    altText: null,
  },
  gallery: [
    {
      id: "g1",
      url: "https://storage.test/image?signature=secret",
      expiresAt: "2030-01-01T00:00:00Z",
      altText: null,
      isCover: true,
    },
  ],
  serviceDetails: null,
  ...overrides,
});

beforeEach(() => vi.clearAllMocks());

describe("public catalog detail service", () => {
  it("calls the encoded public detail endpoint without auth", async () => {
    apiFetch.mockResolvedValue(detail());
    await publicCatalogService.detail("demo-product");
    expect(apiFetch).toHaveBeenCalledWith("/catalog/products/demo-product", { auth: false });
  });
  it.each([
    "",
    "Demo",
    "with space",
    "under_score",
    "two--hyphens",
    "-start",
    "end-",
    "a".repeat(61),
  ])("rejects invalid slug %s before the network", async (slug) => {
    await expect(publicCatalogService.detail(slug)).rejects.toThrow("INVALID_PUBLIC_CATALOG_SLUG");
    expect(apiFetch).not.toHaveBeenCalled();
  });
  it("preserves HTTP errors", async () => {
    const error = new Error("http");
    apiFetch.mockRejectedValue(error);
    await expect(publicCatalogService.detail("demo-product")).rejects.toBe(error);
  });
});

describe("public catalog detail parser", () => {
  it("parses NORMAL, DYNAMIC, FIXED service and QUOTE service", () => {
    expect(parsePublicCatalogDetailResponse(detail()).model).toBe("NORMAL");
    expect(
      parsePublicCatalogDetailResponse(
        detail({
          model: "DYNAMIC",
          pricing: { kind: "FROM", amount: "9.90" },
          variants: [{ id: "v1", title: "Pequeno", description: null, price: "9.90", stock: 3 }],
        }),
      ).variants,
    ).toHaveLength(1);
    expect(
      parsePublicCatalogDetailResponse(
        detail({
          productType: "SERVICE",
          model: "SERVICE",
          pricing: { kind: "FIXED", amount: "79.90" },
          stock: null,
          serviceDetails: { pricingType: "FIXED", basePrice: "79.90", estimatedDelivery: "2 dias" },
        }),
      ).serviceDetails,
    ).toMatchObject({ pricingType: "FIXED" });
    expect(
      parsePublicCatalogDetailResponse(
        detail({
          productType: "SERVICE",
          model: "SERVICE",
          pricing: { kind: "QUOTE", amount: null },
          stock: null,
          serviceDetails: { pricingType: "QUOTE", basePrice: null, estimatedDelivery: "2 dias" },
        }),
      ).serviceDetails,
    ).toMatchObject({ pricingType: "QUOTE" });
  });
  it.each([
    { description: " " },
    { deliveryMode: "FAST" },
    { variants: {} },
    { variants: [{ id: "v", title: "V", description: null, price: "-1", stock: 1 }] },
    { variants: [{ id: "v", title: "V", description: null, price: "1.00", stock: -1 }] },
    { gallery: [] },
    {
      gallery: [
        { id: "g1", url: "ftp://bad", expiresAt: "2030-01-01", altText: null, isCover: true },
      ],
    },
    {
      gallery: [
        {
          id: "g1",
          url: "https://storage.test/image?signature=secret",
          expiresAt: "bad",
          altText: null,
          isCover: true,
        },
      ],
    },
    {
      gallery: [
        {
          id: "g1",
          url: "https://storage.test/image?signature=secret",
          expiresAt: "2030-01-01T00:00:00Z",
          altText: null,
          isCover: false,
        },
      ],
    },
    { serviceDetails: { pricingType: "FIXED", basePrice: "49.90", estimatedDelivery: "2 dias" } },
    { model: "DYNAMIC", pricing: { kind: "FROM", amount: "9.90" }, variants: [] },
  ])("rejects malformed detail %#", (override) =>
    expect(() => parsePublicCatalogDetailResponse(detail(override))).toThrow(
      MALFORMED_PUBLIC_CATALOG_RESPONSE,
    ),
  );
  it("ignores unrelated private fields rather than using them", () => {
    expect(
      parsePublicCatalogDetailResponse(detail({ buyerRequirements: "private" })),
    ).not.toHaveProperty("buyerRequirements");
  });
});
