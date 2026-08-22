import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  PublicProductDetailContent,
  PublicProductDetailGallery,
  PublicProductDetailError,
  PublicProductDetailNotFound,
  PublicProductDetailSkeleton,
} from "@/components/public-product-detail";
import type { PublicCatalogProductDetail } from "@/services/publicCatalog";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    params,
    search,
    children,
    ...props
  }: {
    to: string;
    params?: Record<string, string>;
    search?: Record<string, string>;
    children: React.ReactNode;
  }) => {
    let href = to;
    for (const [key, value] of Object.entries(params ?? {})) href = href.replace(`$${key}`, value);
    const query = new URLSearchParams(search).toString();
    return (
      <a href={`${href}${query ? `?${query}` : ""}`} {...props}>
        {children}
      </a>
    );
  },
}));
vi.mock("@/providers/AuthContext", () => ({
  useAuth: () => ({ status: "anonymous" }),
}));
vi.mock("@/services/cartApiHooks", () => ({
  useBuyerSellerCart: () => ({ isPending: true }),
  useAddBuyerCartItem: () => ({ mutate: vi.fn(), reset: vi.fn(), isPending: false }),
}));

const image = (id: string, url: string, isCover = false, altText: string | null = null) => ({
  id,
  url,
  expiresAt: "2030-01-01T00:00:00Z",
  altText,
  isCover,
});
const product = (
  overrides: Partial<PublicCatalogProductDetail> = {},
): PublicCatalogProductDetail => ({
  id: "public-id",
  slug: "produto-real",
  title: "Título exclusivamente real",
  shortDescription: "Resumo real",
  description: "Descrição exclusivamente fornecida pela API",
  productType: "GAME",
  model: "NORMAL",
  pricing: { kind: "FIXED", amount: "49.90" },
  stock: 10,
  category: { slug: "jogos", name: "Jogos reais" },
  subcategory: { slug: "pc", name: "PC real" },
  seller: { slug: "loja-real", storeName: "Loja Real", verified: false },
  coverImage: {
    url: "https://images.test/cover",
    expiresAt: "2030-01-01T00:00:00Z",
    altText: "Capa real",
  },
  deliveryMode: "MANUAL",
  variants: [],
  gallery: [image("cover", "https://images.test/cover", true, "Capa real")],
  serviceDetails: null,
  ...overrides,
});

const absentCommerce = () => {
  for (const label of [
    "Favoritar",
    "Quantidade",
    "LIT Points",
    "Proteção LIT",
    "avaliações",
    "perguntas",
    "produtos relacionados",
    "denúncias",
  ])
    expect(screen.queryByText(label, { exact: false })).not.toBeInTheDocument();
};

describe("public product detail content", () => {
  it("renders only real public metadata, breadcrumbs, FIXED price and no commerce or seller metrics", () => {
    render(<PublicProductDetailContent product={product()} />);
    expect(screen.getByRole("heading", { name: "Título exclusivamente real" })).toBeInTheDocument();
    expect(screen.getByText("Descrição exclusivamente fornecida pela API")).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*49,90/)).toBeInTheDocument();
    expect(screen.getByText("Entrega manual")).toBeInTheDocument();
    expect(screen.getByText("Loja Real")).toBeInTheDocument();
    expect(screen.getByText("loja-real")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Jogos reais" })).toHaveAttribute(
      "href",
      "/categoria/jogos",
    );
    expect(screen.getByRole("link", { name: "PC real" })).toHaveAttribute(
      "href",
      "/categoria/jogos?subcategory=pc",
    );
    expect(screen.queryByRole("link", { name: /Loja Real|loja-real/ })).not.toBeInTheDocument();
    expect(screen.getByText("Vendedor não verificado")).toBeVisible();
    expect(screen.queryByText(/reputa|nível|vendas|em análise/i)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Entrar para comprar" })).toHaveAttribute(
      "href",
      "/login",
    );
    expect(screen.getByText(/pagamento Alpha usam o fluxo persistente/i)).toBeInTheDocument();
    expect(screen.getByText(/comunicação com o vendedor permanece fora/i)).toBeInTheDocument();
    absentCommerce();
  });
  it("renders the authoritative verified state with the same truthful copy", () => {
    render(
      <PublicProductDetailContent
        product={product({ seller: { slug: "loja-real", storeName: "Loja Real", verified: true } })}
      />,
    );
    expect(screen.getByText("Vendedor verificado")).toBeVisible();
    expect(screen.queryByText(/KYC aprovado|garantido pela LIT Buy/i)).not.toBeInTheDocument();
  });
  it("renders FROM variants in API order and hides a generic NORMAL option", () => {
    const variants = [
      { id: "v1", title: "Primeira", description: "Descrição um", price: "9.90", stock: 30 },
      { id: "v2", title: "Segunda", description: null, price: "19.90", stock: 20 },
    ];
    const { rerender } = render(
      <PublicProductDetailContent
        product={product({ model: "DYNAMIC", pricing: { kind: "FROM", amount: "9.90" }, variants })}
      />,
    );
    expect(screen.getByText(/A partir de R\$\s*9,90/)).toBeInTheDocument();
    const options = screen.getByRole("group", { name: "Escolha uma variante" });
    expect(
      within(options)
        .getAllByRole("button")
        .map((node) => node.querySelector("span")?.textContent),
    ).toEqual(["Primeira", "Segunda"]);
    expect(within(options).getByText("30 em estoque")).toBeInTheDocument();
    rerender(
      <PublicProductDetailContent
        product={product({
          variants: [
            { id: "only", title: "Opção única", description: null, price: "49.90", stock: 10 },
          ],
        })}
      />,
    );
    expect(screen.queryByRole("group", { name: "Escolha uma variante" })).not.toBeInTheDocument();
  });
  it("renders automatic delivery, non-applicable stock and FIXED/QUOTE services", () => {
    const fixed = product({
      productType: "SERVICE",
      model: "SERVICE",
      stock: null,
      deliveryMode: "AUTOMATIC",
      pricing: { kind: "FIXED", amount: "79.90" },
      variants: [{ id: "format", title: "Formato", description: null, price: "79.90", stock: 1 }],
      serviceDetails: {
        pricingType: "FIXED",
        basePrice: "79.90",
        estimatedDelivery: "Até 2 dias úteis",
      },
    });
    const { rerender } = render(<PublicProductDetailContent product={fixed} />);
    expect(screen.getByText("Não aplicável")).toBeInTheDocument();
    expect(screen.getByText("Entrega automática")).toBeInTheDocument();
    expect(
      screen.queryByText("A compra ainda não está disponível nesta etapa."),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Formatos do serviço")).toBeInTheDocument();
    expect(screen.getByText("Preço fixo")).toBeInTheDocument();
    expect(screen.getAllByText(/R\$\s*79,90/).length).toBeGreaterThan(0);
    expect(screen.getByText("Até 2 dias úteis")).toBeInTheDocument();
    rerender(
      <PublicProductDetailContent
        product={product({
          productType: "SERVICE",
          model: "SERVICE",
          stock: null,
          pricing: { kind: "QUOTE", amount: null },
          serviceDetails: {
            pricingType: "QUOTE",
            basePrice: null,
            estimatedDelivery: "Até 2 dias úteis",
          },
        })}
      />,
    );
    expect(screen.getAllByText("Sob orçamento").length).toBeGreaterThan(0);
  });
});

describe("public detail gallery and states", () => {
  it("uses the cover first, preserves thumbnail order and switches with aria-pressed", () => {
    const gallery = [
      image("other", "https://images.test/other", false, "Outra real"),
      image("cover", "https://images.test/cover", true, "Capa real"),
    ];
    render(<PublicProductDetailGallery product={product({ gallery })} />);
    expect(screen.getAllByRole("img")[0]).toHaveAttribute("src", "https://images.test/cover");
    const buttons = screen.getAllByRole("button");
    expect(buttons.map((button) => within(button).getByRole("img").getAttribute("src"))).toEqual(
      gallery.map((item) => item.url),
    );
    expect(buttons[1]).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(buttons[0]);
    expect(buttons[0]).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByRole("img")[0]).toHaveAttribute("alt", "Outra real");
  });
  it("falls back to title, handles main/thumbnail errors and retries a renewed URL", () => {
    const initial = product({
      coverImage: {
        url: "https://images.test/old",
        expiresAt: "2030-01-01T00:00:00Z",
        altText: null,
      },
      gallery: [
        image("cover", "https://images.test/old", true),
        image("other", "https://images.test/other"),
      ],
    });
    const { rerender } = render(<PublicProductDetailGallery product={initial} />);
    const main = screen.getAllByRole("img", { name: initial.title })[0];
    fireEvent.error(main);
    expect(screen.getByRole("img", { name: "Imagem indisponível" })).toBeInTheDocument();
    fireEvent.error(screen.getAllByRole("img", { name: initial.title })[0]);
    expect(
      screen.getByRole("img", { name: `Miniatura indisponível: ${initial.title}` }),
    ).toBeInTheDocument();
    const renewed = product({
      coverImage: {
        url: "https://images.test/new",
        expiresAt: "2030-01-01T00:00:00Z",
        altText: null,
      },
      gallery: [image("cover", "https://images.test/new", true)],
    });
    rerender(<PublicProductDetailGallery product={renewed} />);
    expect(screen.getByRole("img", { name: renewed.title })).toHaveAttribute(
      "src",
      "https://images.test/new",
    );
  });
  it("resets an invalid selection when product or gallery changes", () => {
    const { rerender } = render(
      <PublicProductDetailGallery
        product={product({
          gallery: [
            image("cover", "https://images.test/cover", true),
            image("other", "https://images.test/other"),
          ],
        })}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Exibir imagem 2/ }));
    rerender(
      <PublicProductDetailGallery
        product={product({
          id: "second",
          gallery: [image("new-cover", "https://images.test/new", true)],
        })}
      />,
    );
    expect(screen.getByRole("img")).toHaveAttribute("src", "https://images.test/new");
  });
  it("renders loading, safe error retry and uniform not found", () => {
    const retry = vi.fn();
    const { rerender } = render(<PublicProductDetailSkeleton />);
    expect(screen.getByLabelText("Carregando produto")).toBeInTheDocument();
    rerender(<PublicProductDetailError onRetry={retry} />);
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(retry).toHaveBeenCalledOnce();
    rerender(<PublicProductDetailNotFound />);
    expect(screen.getByText("Produto não encontrado")).toBeInTheDocument();
    expect(
      screen.getByText("O anúncio não existe ou não está disponível publicamente."),
    ).toBeInTheDocument();
  });
});
