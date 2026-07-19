import { describe, expect, it, vi, beforeEach } from "vitest";
import { ApiError } from "@/lib/api/client";

const catalog = { bySlug: vi.fn() };
const products = { byCategory: vi.fn() };
const notFound = vi.fn(() => new Error("NOT_FOUND"));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: Record<string, unknown>) => options,
  notFound: () => notFound(),
}));
vi.mock("@/services/catalogService", () => ({ categoryService: catalog }));
vi.mock("@/services/productService", () => ({ productService: products }));
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
  it("loads real category and filtered demonstrative products", async () => {
    catalog.bySlug.mockResolvedValue({ slug: "contas", name: "Contas" });
    products.byCategory.mockResolvedValue([{ id: "p1" }]);
    const mod = await import("@/routes/categoria.$slug");
    await expect(mod.Route.loader({ params: { slug: "contas" } })).resolves.toEqual({
      category: { slug: "contas", name: "Contas" },
      items: [{ id: "p1" }],
    });
  });
  it("converts only catalog category not found to route notFound", async () => {
    catalog.bySlug.mockRejectedValue(new ApiError(404, "CATALOG_CATEGORY_NOT_FOUND", "not found"));
    const mod = await import("@/routes/categoria.$slug");
    await expect(mod.Route.loader({ params: { slug: "old" } })).rejects.toThrow("NOT_FOUND");
    expect(notFound).toHaveBeenCalled();
  });
  it("keeps network and malformed response errors as real errors", async () => {
    const err = new ApiError(502, "CATALOG_RESPONSE_INVALID", "bad payload");
    catalog.bySlug.mockRejectedValue(err);
    const mod = await import("@/routes/categoria.$slug");
    await expect(mod.Route.loader({ params: { slug: "contas" } })).rejects.toBe(err);
  });
});
