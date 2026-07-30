import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import type { PublicCatalogProductDetail } from "@/services/publicCatalog";

const mocks = vi.hoisted(() => ({
  detail: vi.fn(),
  invalidate: vi.fn(),
  productService: vi.fn(),
  reviewService: vi.fn(),
  loaderData: { product: null, failed: true } as {
    product: PublicCatalogProductDetail | null;
    failed: boolean;
  },
  notFound: { kind: "not-found" },
}));
vi.mock("@tanstack/react-router", () => ({
  notFound: () => mocks.notFound,
  useRouter: () => ({ invalidate: mocks.invalidate }),
  Link: ({
    to,
    params,
    children,
    ...props
  }: {
    to: string;
    params?: Record<string, string>;
    children: React.ReactNode;
  }) => (
    <a
      href={Object.entries(params ?? {}).reduce(
        (path, [key, value]) => path.replace(`$${key}`, value),
        to,
      )}
      {...props}
    >
      {children}
    </a>
  ),
  createFileRoute: () => (options: Record<string, unknown>) => ({
    ...options,
    useLoaderData: () => mocks.loaderData,
  }),
}));
vi.mock("@/services/publicCatalog", async (original) => ({
  ...(await original()),
  publicCatalogService: { detail: mocks.detail },
}));
vi.mock("@/services/productService", () => ({
  productService: { byId: mocks.productService, related: mocks.productService },
}));
vi.mock("@/services/reviewService", () => ({ reviewService: { byProduct: mocks.reviewService } }));

const realProduct: PublicCatalogProductDetail = {
  id: "real-id",
  slug: "slug-publico",
  title: "Produto real da API",
  shortDescription: "Resumo",
  description: "Descrição real sem fallback",
  productType: "GAME",
  model: "NORMAL",
  pricing: { kind: "FIXED", amount: "49.90" },
  stock: 2,
  category: { slug: "jogos", name: "Jogos" },
  subcategory: null,
  seller: { slug: "loja", storeName: "Loja" },
  coverImage: {
    url: "https://images.test/cover",
    expiresAt: "2030-01-01T00:00:00Z",
    altText: null,
  },
  deliveryMode: "MANUAL",
  variants: [],
  gallery: [
    {
      id: "g",
      url: "https://images.test/cover",
      expiresAt: "2030-01-01T00:00:00Z",
      altText: null,
      isCover: true,
    },
  ],
  serviceDetails: null,
};

const load = async (id: string) => {
  const { Route } = await import("@/routes/produto.$id");
  return (
    Route as unknown as { loader: (args: { params: { id: string } }) => Promise<unknown> }
  ).loader({ params: { id } });
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.loaderData = { product: null, failed: true };
});

describe("public product detail route", () => {
  it("uses params.id as the public slug and never calls legacy services", async () => {
    mocks.detail.mockResolvedValue(realProduct);
    await expect(load("slug-publico")).resolves.toEqual({ product: realProduct, failed: false });
    expect(mocks.detail).toHaveBeenCalledWith("slug-publico");
    expect(mocks.productService).not.toHaveBeenCalled();
    expect(mocks.reviewService).not.toHaveBeenCalled();
  });
  it.each([
    new TypeError("INVALID_PUBLIC_CATALOG_SLUG"),
    new ApiError(404, "PRODUCT_NOT_FOUND", "hidden"),
  ])("turns only structural invalidity and PRODUCT_NOT_FOUND into not found", async (error) => {
    mocks.detail.mockRejectedValue(error);
    await expect(load("slug")).rejects.toBe(mocks.notFound);
  });
  it.each([
    new ApiError(404, "OTHER_NOT_FOUND", "internal"),
    new ApiError(500, "SERVER", "internal"),
    new TypeError("MALFORMED_PUBLIC_CATALOG_RESPONSE"),
    new Error("network"),
  ])("keeps %s as a safe error rather than not found", async (error) => {
    mocks.detail.mockRejectedValue(error);
    await expect(load("slug")).resolves.toEqual({ product: null, failed: true });
  });
  it.each(["demo-produto-pausado", "demo-produto-nao-publicado"])(
    "does not provide a mock fallback for %s",
    async (slug) => {
      mocks.detail.mockRejectedValue(new ApiError(404, "PRODUCT_NOT_FOUND", "hidden"));
      await expect(load(slug)).rejects.toBe(mocks.notFound);
      expect(mocks.productService).not.toHaveBeenCalled();
    },
  );
  it("renders the real result and no mocked fallback", async () => {
    const { Route } = await import("@/routes/produto.$id");
    mocks.loaderData = { product: realProduct, failed: false };
    render(<Route.component />);
    expect(screen.getByRole("heading", { name: realProduct.title })).toBeInTheDocument();
    expect(screen.getByText(realProduct.description)).toBeInTheDocument();
    expect(screen.queryByText(/produto demonstrativo/i)).not.toBeInTheDocument();
  });
  it("renders a safe failure and retry invalidates the actual router", async () => {
    const { Route } = await import("@/routes/produto.$id");
    mocks.loaderData = { product: null, failed: true };
    render(<Route.component />);
    expect(screen.queryByText(/produto demonstrativo|network|internal/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(mocks.invalidate).toHaveBeenCalledOnce();
  });
});
