import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  CategoryCatalogContent,
  CategoryCatalogControls,
  CategoryCatalogError,
  CategoryCatalogPagination,
  CategoryCatalogSkeleton,
} from "@/components/category-catalog";
import { PublicCatalogCard } from "@/components/public-catalog";
import type { PublicCatalogListResponse } from "@/services/publicCatalog";

const subcategories = [
  { id: "1", slug: "demo-contas", name: "Contas", categorySlug: "demo-jogos" },
  { id: "2", slug: "demo-servicos", name: "Serviços", categorySlug: "demo-jogos" },
];
const product = {
  id: "1",
  slug: "demo",
  title: "Produto real",
  shortDescription: "Descrição",
  productType: "SERVICE",
  model: "SERVICE",
  pricing: { kind: "QUOTE", amount: null },
  stock: null,
  category: { slug: "demo-jogos", name: "Jogos" },
  subcategory: null,
  seller: { slug: "loja", storeName: "Loja" },
  coverImage: { url: "/fallback.webp", expiresAt: "2030-01-01T00:00:00.000Z", altText: null },
} as const;
const catalog = (items = [product], page = 1, hasNext = false): PublicCatalogListResponse => ({
  items: [...items],
  pagination: { page, limit: 12, hasNext },
});

describe("category catalog controls", () => {
  it("shows only the real filters and emits every change", () => {
    const onChange = vi.fn();
    render(
      <CategoryCatalogControls subcategories={subcategories} sort="RECENT" onChange={onChange} />,
    );
    expect(screen.getByRole("option", { name: "Todas" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Serviços" })).toBeInTheDocument();
    expect(within(screen.getByLabelText("Tipo de produto")).getAllByRole("option")).toHaveLength(
      12,
    );
    expect(within(screen.getByLabelText("Ordenar")).getAllByRole("option")).toHaveLength(4);
    fireEvent.change(screen.getByLabelText("Subcategoria"), { target: { value: "demo-servicos" } });
    fireEvent.change(screen.getByLabelText("Tipo de produto"), { target: { value: "SERVICE" } });
    fireEvent.change(screen.getByLabelText("Ordenar"), { target: { value: "OLDEST" } });
    expect(onChange.mock.calls.map(([value]) => value)).toEqual([
      { subcategory: "demo-servicos" },
      { productType: "SERVICE" },
      { sort: "OLDEST" },
    ]);
    for (const falseFilter of [
      "Preço",
      "Região",
      "Plataforma",
      "Entrega",
      "Vendedor verificado",
      "Mais vendidos",
      "Avaliações",
    ])
      expect(screen.queryByText(falseFilter, { exact: false })).not.toBeInTheDocument();
  });
});

describe("category catalog pagination", () => {
  it("disables boundaries and emits adjacent pages", () => {
    const onPage = vi.fn();
    const { rerender } = render(<CategoryCatalogPagination page={1} hasNext onPage={onPage} />);
    expect(screen.getByRole("button", { name: "Anterior" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    expect(onPage).toHaveBeenCalledWith(2);
    rerender(<CategoryCatalogPagination page={3} hasNext={false} onPage={onPage} />);
    expect(screen.getByRole("button", { name: "Anterior" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Próxima" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Anterior" }));
    expect(onPage).toHaveBeenCalledWith(2);
  });
});

describe("category catalog states", () => {
  const callbacks = { onFilterChange: vi.fn(), onClearFilters: vi.fn(), onPageChange: vi.fn() };
  it("reports only displayed items and renders informational cards without commerce links", () => {
    render(
      <CategoryCatalogContent
        catalog={catalog()}
        subcategories={[]}
        sort="RECENT"
        {...callbacks}
      />,
    );
    expect(screen.getByText("Exibindo 1 anúncio nesta página")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    for (const action of ["Carrinho", "Favorito", "Comprar"])
      expect(screen.queryByText(action, { exact: false })).not.toBeInTheDocument();
  });
  it.each([
    [1, undefined, "RECENT", "Ainda não existem anúncios públicos nesta categoria."],
    [1, "SERVICE", "RECENT", "Nenhum anúncio encontrado para estes filtros."],
    [8, undefined, "RECENT", "Nenhum anúncio disponível nesta página."],
    [8, "SERVICE", "RECENT", "Nenhum anúncio encontrado nesta página para estes filtros."],
  ] as const)("renders the correct empty state", (page, productType, sort, message) => {
    render(
      <CategoryCatalogContent
        catalog={catalog([], page)}
        subcategories={[]}
        productType={productType}
        sort={sort}
        {...callbacks}
      />,
    );
    expect(screen.getByText(message)).toBeInTheDocument();
    if (productType) {
      fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
      expect(callbacks.onClearFilters).toHaveBeenCalled();
    }
    if (page > 1) expect(screen.getByRole("button", { name: "Anterior" })).toBeEnabled();
  });
  it("offers a safe retry and renders twelve skeleton cards", () => {
    const retry = vi.fn();
    const { unmount } = render(<CategoryCatalogError onRetry={retry} />);
    expect(screen.queryByText("internal", { exact: false })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(retry).toHaveBeenCalled();
    unmount();
    render(<CategoryCatalogSkeleton />);
    expect(screen.getByLabelText("Carregando anúncios públicos").children).toHaveLength(12);
  });
  it("keeps a standalone public card informational", () => {
    render(<PublicCatalogCard product={product} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText(/detalhes em breve/i)).toBeInTheDocument();
  });
});
