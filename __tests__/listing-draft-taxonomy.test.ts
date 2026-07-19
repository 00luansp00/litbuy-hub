import { beforeEach, describe, expect, it, vi } from "vitest";

const catalog = {
  getCategories: vi.fn(),
  getSubcategoriesByCategory: vi.fn(),
  getProductTypes: vi.fn(),
  getAttributesForSubcategory: vi.fn(),
};
vi.mock("@/services/catalogService", () => ({ catalogService: catalog }));

describe("listingDraftService taxonomy integration", () => {
  beforeEach(() => vi.clearAllMocks());
  it("uses real catalog APIs for categories, subcategories, product types and attributes", async () => {
    catalog.getCategories.mockResolvedValue([{ slug: "contas", name: "Contas" }]);
    catalog.getSubcategoriesByCategory.mockResolvedValue([{ slug: "valorant", name: "Valorant" }]);
    catalog.getProductTypes.mockResolvedValue([{ id: "account", name: "Conta" }]);
    catalog.getAttributesForSubcategory.mockResolvedValue([
      { key: "elo", label: "Elo", type: "text" },
    ]);
    const { listingDraftService } = await import("@/services/listingDraftService");
    await expect(listingDraftService.getCategories()).resolves.toEqual([
      { slug: "contas", name: "Contas" },
    ]);
    await expect(listingDraftService.getSubcategoriesByCategory("contas")).resolves.toEqual([
      { slug: "valorant", name: "Valorant", categorySlug: "contas" },
    ]);
    await expect(listingDraftService.getProductTypes()).resolves.toEqual([
      { id: "account", name: "Conta" },
    ]);
    await expect(
      listingDraftService.getAttributesForSubcategory("valorant", "account", "contas"),
    ).resolves.toEqual([{ key: "elo", label: "Elo", type: "text" }]);
  });
  it("does not fall back to mock taxonomy when the catalog API fails and keeps commercial parts demonstrative", async () => {
    catalog.getCategories.mockRejectedValue(new Error("catalog down"));
    const { listingDraftService } = await import("@/services/listingDraftService");
    await expect(listingDraftService.getCategories()).rejects.toThrow("catalog down");
    await expect(listingDraftService.getPromotionTiers()).resolves.toHaveLength(3);
    await expect(listingDraftService.getSellerPlans()).resolves.not.toHaveLength(0);
    await expect(
      listingDraftService.simulateSubmitListingDraft({} as never),
    ).resolves.toMatchObject({ ok: true });
  });
});
