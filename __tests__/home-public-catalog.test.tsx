import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicCatalogCard as CatalogCard } from "@/services/publicCatalog";
import {
  PublicCatalogCard,
  PublicCatalogSection,
  PublicCatalogSkeleton,
} from "@/components/public-catalog";

const categoryList = vi.fn();
const catalogList = vi.fn();
const invalidate = vi.fn();
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: Record<string, unknown>) => options,
  useRouter: () => ({ invalidate }),
  Link: ({
    to,
    params,
    children,
    ...props
  }: {
    to: string;
    params?: { id?: string };
    children: React.ReactNode;
  }) => (
    <a href={params?.id ? to.replace("$id", params.id) : to} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("@/services/catalogService", () => ({ categoryService: { list: categoryList } }));
vi.mock("@/services/publicCatalog", async (importOriginal) => ({
  ...(await importOriginal()),
  publicCatalogService: { list: catalogList },
}));

const product = (id: string, pricing: CatalogCard["pricing"]): CatalogCard => ({
  id,
  slug: `produto-${id}`,
  title: `Produto ${id}`,
  shortDescription: "Descrição pública sem métricas inventadas.",
  productType: "GAME",
  model: "NORMAL",
  pricing,
  stock: id === "2" ? null : 4,
  category: { slug: "jogos", name: "Jogos" },
  subcategory: null,
  seller: { slug: "loja-demo", storeName: "Loja Demo", verified: false },
  coverImage: {
    url: `https://storage.local/${id}`,
    expiresAt: "2030-01-01T00:00:00Z",
    altText: null,
  },
});
const six = [
  product("1", { kind: "FIXED", amount: "49.90" }),
  product("2", { kind: "FROM", amount: "9.90" }),
  product("3", { kind: "QUOTE", amount: null }),
  ...[4, 5, 6].map((id) => product(String(id), { kind: "FIXED", amount: "100.00" })),
];

beforeEach(() => vi.clearAllMocks());

describe("Home public catalog", () => {
  it("loader calls only the real catalog list with the Home query", async () => {
    categoryList.mockResolvedValue([{ slug: "jogos" }]);
    catalogList.mockResolvedValue({
      items: six,
      pagination: { page: 1, limit: 8, hasNext: false },
    });
    const { Route } = await import("@/routes/index");
    await expect(Route.loader({} as never)).resolves.toMatchObject({
      catalog: { status: "success" },
    });
    expect(catalogList).toHaveBeenCalledWith({ sort: "RECENT", page: 1, limit: 8 });
  });
  it("keeps a catalog failure visible and never falls back to mock products", async () => {
    categoryList.mockResolvedValue([]);
    catalogList.mockRejectedValue(new Error("network"));
    const { Route } = await import("@/routes/index");
    await expect(Route.loader({} as never)).resolves.toEqual({
      categories: [],
      catalog: { status: "error" },
    });
  });
  it("renders one informational section with six real cards and all pricing kinds", () => {
    render(
      <PublicCatalogSection
        catalog={{ items: six, pagination: { page: 1, limit: 8, hasNext: false } }}
      />,
    );
    expect(screen.getAllByRole("article")).toHaveLength(6);
    expect(screen.getByText(/R\$\s*49,90/)).toBeInTheDocument();
    expect(screen.getByText(/A partir de R\$\s*9,90/)).toBeInTheDocument();
    expect(screen.getByText("Sob orçamento")).toBeInTheDocument();
    expect(screen.getAllByText("Vendedor não verificado")).toHaveLength(6);
    expect(screen.queryByText(/avaliaç|vendid/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /detalhes/i })).toHaveLength(12);
  });
  it("renders the authoritative verified state on a card", () => {
    render(
      <PublicCatalogCard product={{ ...six[0], seller: { ...six[0].seller, verified: true } }} />,
    );
    expect(screen.getByText("Vendedor verificado")).toBeVisible();
    expect(screen.queryByText(/KYC aprovado|100% seguro/i)).not.toBeInTheDocument();
  });
  it("renders an empty result as a valid state", () => {
    render(
      <PublicCatalogSection
        catalog={{ items: [], pagination: { page: 1, limit: 8, hasNext: false } }}
      />,
    );
    expect(screen.getByText("Nenhum anúncio público disponível no momento.")).toBeInTheDocument();
  });
  it("renders a safe error and retries", () => {
    render(<PublicCatalogSection error onRetry={invalidate} />);
    fireEvent.click(screen.getByRole("button", { name: /tentar novamente/i }));
    expect(invalidate).toHaveBeenCalledOnce();
    expect(screen.queryByText(/network|stack|minio/i)).not.toBeInTheDocument();
  });
  it("renders eight skeleton cards", () => {
    render(<PublicCatalogSkeleton />);
    expect(screen.getByLabelText("Carregando anúncios públicos").children).toHaveLength(8);
  });
  it("tries a renewed signed image URL after the previous URL failed", () => {
    const first = product("1", { kind: "FIXED", amount: "49.90" });
    const { rerender } = render(<PublicCatalogCard product={first} />);
    fireEvent.error(screen.getByRole("img", { name: first.title }));
    expect(
      screen.getByRole("img", { name: `Imagem indisponível: ${first.title}` }),
    ).toBeInTheDocument();

    const renewed = {
      ...first,
      coverImage: { ...first.coverImage, url: "https://storage.local/renewed-signed-url" },
    };
    rerender(<PublicCatalogCard product={renewed} />);
    const image = screen.getByRole("img", { name: first.title });
    expect(image).toHaveAttribute("src", renewed.coverImage.url);
    expect(image).not.toHaveAttribute("src", first.coverImage.url);
  });
});
