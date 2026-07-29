import { describe, expect, it, vi, beforeEach } from "vitest";
import { ApiError } from "@/lib/api/client";

const catalog = { bySlug: vi.fn(), getSubcategoriesByCategory: vi.fn() };
const products = { byCategory: vi.fn() };
const publicCatalog = { list: vi.fn() };
const notFound = vi.fn(() => new Error("NOT_FOUND"));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: Record<string, unknown>) => options,
  notFound: () => notFound(),
  redirect: (options: unknown) =>
    Object.assign(new Error("REDIRECT"), { isRedirect: true, options }),
  useNavigate: vi.fn(),
  useRouter: vi.fn(),
}));
vi.mock("@/services/catalogService", () => ({ categoryService: catalog }));
vi.mock("@/services/productService", () => ({ productService: products }));
vi.mock("@/services/publicCatalog", async (original) => ({
  ...(await original()),
  publicCatalogService: publicCatalog,
}));
vi.mock("@/components/common/Breadcrumb", () => ({ Breadcrumb: () => null }));
vi.mock("@/components/common/CategoryHero", () => ({ CategoryHero: () => null }));
vi.mock("@/components/common/EmptyState", () => ({ EmptyState: () => null }));
vi.mock("@/components/common/FilterSidebar", () => ({ FilterSidebar: () => null }));
vi.mock("@/components/common/ProductGrid", () => ({ ProductGrid: () => null }));
vi.mock("@/components/common/SortBar", () => ({ SortBar: () => null }));
vi.mock("@/components/ui/button", () => ({ Button: () => null }));
vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children }: { children: unknown }) => children,
  SheetContent: ({ children }: { children: unknown }) => children,
  SheetTitle: ({ children }: { children: unknown }) => children,
  SheetTrigger: ({ children }: { children: unknown }) => children,
}));

beforeEach(() => vi.clearAllMocks());

describe("/categoria/$slug loader", () => {
  it("loads the real category, subcategories and public products", async () => {
    catalog.bySlug.mockResolvedValue({ slug: "contas", name: "Contas" });
    catalog.getSubcategoriesByCategory.mockResolvedValue([{ slug: "pc", name: "PC" }]);
    const response = { items: [{ id: "p1" }], pagination: { page: 1, limit: 12, hasNext: false } };
    publicCatalog.list.mockResolvedValue(response);
    const mod = await import("@/routes/categoria.$slug");
    await expect(
      mod.Route.loader({ params: { slug: "contas" }, deps: { sort: "RECENT", page: 1 } }),
    ).resolves.toEqual({
      category: { slug: "contas", name: "Contas" },
      subcategories: [{ slug: "pc", name: "PC" }],
      catalog: response,
      catalogError: false,
    });
    expect(publicCatalog.list).toHaveBeenCalledWith({
      categorySlug: "contas",
      subcategorySlug: undefined,
      productType: undefined,
      sort: "RECENT",
      page: 1,
      limit: 12,
    });
    expect(products.byCategory).not.toHaveBeenCalled();
  });
  it("converts only catalog category not found to route notFound", async () => {
    catalog.bySlug.mockRejectedValue(new ApiError(404, "CATALOG_CATEGORY_NOT_FOUND", "not found"));
    const mod = await import("@/routes/categoria.$slug");
    await expect(
      mod.Route.loader({ params: { slug: "old" }, deps: { sort: "RECENT", page: 1 } }),
    ).rejects.toThrow("NOT_FOUND");
    expect(notFound).toHaveBeenCalled();
  });
  it("keeps network and malformed response errors as real errors", async () => {
    const err = new ApiError(502, "CATALOG_RESPONSE_INVALID", "bad payload");
    catalog.bySlug.mockRejectedValue(err);
    const mod = await import("@/routes/categoria.$slug");
    await expect(
      mod.Route.loader({ params: { slug: "contas" }, deps: { sort: "RECENT", page: 1 } }),
    ).rejects.toBe(err);
  });
  it("normalizes public search parameters without mocking the parser", async () => {
    const mod = await import("@/routes/categoria.$slug");
    expect(
      mod.normalizeCategorySearch({
        subcategory: "Bad Slug",
        productType: "BAD",
        sort: "BAD",
        page: 0,
      }),
    ).toEqual({ subcategory: undefined, productType: undefined, sort: "RECENT", page: 1 });
    expect(
      mod.normalizeCategorySearch({
        subcategory: "demo-servicos",
        productType: "SERVICE",
        sort: "TITLE_DESC",
        page: "2",
      }),
    ).toEqual({
      subcategory: "demo-servicos",
      productType: "SERVICE",
      sort: "TITLE_DESC",
      page: 2,
    });
  });
  it("preserves category and returns a safe catalog error", async () => {
    catalog.bySlug.mockResolvedValue({ slug: "contas", name: "Contas" });
    catalog.getSubcategoriesByCategory.mockRejectedValue(new Error("internal URL"));
    const mod = await import("@/routes/categoria.$slug");
    await expect(
      mod.Route.loader({ params: { slug: "contas" }, deps: { sort: "RECENT", page: 1 } }),
    ).resolves.toMatchObject({ catalog: null, catalogError: true, subcategories: [] });
  });
});
