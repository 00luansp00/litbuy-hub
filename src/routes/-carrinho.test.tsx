import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BuyerCart } from "@/services/cartApiService";
import { CarrinhoPage } from "./carrinho";

const mocks = vi.hoisted(() => ({
  authStatus: "authenticated",
  cartsQuery: {} as Record<string, unknown>,
  useBuyerCarts: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => options,
  Link: ({
    children,
    to,
    search,
  }: {
    children: React.ReactNode;
    to: string;
    search?: { sellerSlug: string };
  }) => <a href={search ? `${to}?sellerSlug=${search.sellerSlug}` : to}>{children}</a>,
}));
vi.mock("@/providers/AuthContext", () => ({
  useAuth: () => ({ status: mocks.authStatus }),
}));
vi.mock("@/providers/CartProvider", () => {
  throw new Error("The real cart route must not import CartProvider");
});
vi.mock("@/services/cartApiHooks", () => ({
  useBuyerCarts: mocks.useBuyerCarts,
  useBuyerSellerCart: () => ({ refetch: vi.fn() }),
  useUpdateBuyerCartItem: () => ({ mutate: vi.fn(), isPending: false }),
  useRemoveBuyerCartItem: () => ({ mutate: vi.fn(), isPending: false }),
}));

const cart = (
  sellerSlug: string,
  title: string,
  subtotal: string | null,
  items = 1,
): BuyerCart => ({
  id: `cart-${sellerSlug}`,
  status: "ACTIVE",
  version: sellerSlug === "seller-a" ? 3 : 8,
  currency: "BRL",
  seller: { slug: sellerSlug, storeName: `Loja ${sellerSlug.at(-1)?.toUpperCase()}` },
  items: Array.from({ length: items }, (_, index) => ({
    id: `item-${sellerSlug}-${index}`,
    quantity: 1,
    product: { id: `product-${sellerSlug}`, slug: `produto-${sellerSlug}`, title, model: "NORMAL" },
    variant: null,
    currentUnitAmountMinor: subtotal,
    currentLineAmountMinor: subtotal,
    purchasable: true,
    issues: [],
  })),
  previewSubtotalMinor: subtotal,
  checkoutReady: subtotal !== null && items > 0,
  previewFingerprint: `fingerprint-${sellerSlug}`,
  buyerVipPreviewFingerprints: { NONE: "fp-none", BASIC: "fp-basic", PREMIUM: "fp-premium" },
  buyerVipOptions: {
    NONE: {
      plan: "NONE",
      available: true,
      pricingAvailable: true,
      unavailableCode: null,
      percentBps: 0,
      feeAmountMinor: "0",
      totalAmountMinor: "2500",
      fingerprint: "fp-none",
    },
    BASIC: {
      plan: "BASIC",
      available: true,
      pricingAvailable: true,
      unavailableCode: null,
      percentBps: 299,
      feeAmountMinor: "74",
      totalAmountMinor: "2574",
      fingerprint: "fp-basic",
    },
    PREMIUM: {
      plan: "PREMIUM",
      available: true,
      pricingAvailable: true,
      unavailableCode: null,
      percentBps: 499,
      feeAmountMinor: "124",
      totalAmountMinor: "2624",
      fingerprint: "fp-premium",
    },
  },
  createdAt: "2026-08-10",
  updatedAt: "2026-08-10",
});

beforeEach(() => {
  mocks.authStatus = "authenticated";
  mocks.cartsQuery = { data: { page: 1, limit: 20, items: [] }, isPending: false, isError: false };
  mocks.useBuyerCarts.mockReset();
  mocks.useBuyerCarts.mockImplementation(() => mocks.cartsQuery);
});

describe("CarrinhoPage", () => {
  it("loads the initial page with the backend limit", () => {
    render(<CarrinhoPage />);
    expect(mocks.useBuyerCarts).toHaveBeenCalledWith(1, 20);
  });

  it("handles initializing, anonymous, and intermediate authentication without cart content", () => {
    mocks.authStatus = "initializing";
    const { rerender } = render(<CarrinhoPage />);
    expect(screen.getByText("Verificando sua sessão…")).toBeTruthy();

    mocks.authStatus = "anonymous";
    rerender(<CarrinhoPage />);
    expect(screen.getByRole("link", { name: "Entrar para ver seu carrinho" })).toBeTruthy();

    for (const status of [
      "emailVerificationRequired",
      "deviceApprovalRequired",
      "twoFactorRequired",
    ]) {
      mocks.authStatus = status;
      rerender(<CarrinhoPage />);
      expect(
        screen.getByText("Conclua a autenticação da sua conta para ver seu carrinho."),
      ).toBeTruthy();
      expect(screen.queryByText("Carregando seus carrinhos…")).toBeNull();
    }
  });

  it("handles authenticated loading, error, and retry", () => {
    const refetch = vi.fn();
    mocks.cartsQuery = { isPending: true, isError: false };
    const { rerender } = render(<CarrinhoPage />);
    expect(screen.getByText("Carregando seus carrinhos…")).toBeTruthy();

    mocks.cartsQuery = { isPending: false, isError: true, refetch };
    rerender(<CarrinhoPage />);
    screen.getByRole("button", { name: "Tentar novamente" }).click();
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("uses the empty state without next for zero carts and a partial page of empty carts", () => {
    const { rerender } = render(<CarrinhoPage />);
    expect(screen.getByText("Seu carrinho está vazio")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Próxima" })).toBeNull();

    mocks.cartsQuery = {
      data: {
        page: 1,
        limit: 20,
        items: Array.from({ length: 5 }, (_, index) =>
          cart(`seller-empty-${index}`, `Produto ${index}`, "0", 0),
        ),
      },
      isPending: false,
      isError: false,
    };
    rerender(<CarrinhoPage />);
    expect(screen.getByText("Seu carrinho está vazio")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Próxima" })).toBeNull();
  });

  it("keeps next reachable through 20 empty active carts and reveals real items on page two", () => {
    mocks.cartsQuery = {
      data: {
        page: 1,
        limit: 20,
        items: Array.from({ length: 20 }, (_, index) =>
          cart(`seller-empty-${index}`, `Produto vazio ${index}`, "0", 0),
        ),
      },
      isPending: false,
      isError: false,
    };
    const { rerender } = render(<CarrinhoPage />);

    expect(screen.getByText("Seu carrinho está vazio")).toBeTruthy();
    const next = screen.getByRole("button", { name: "Próxima" }) as HTMLButtonElement;
    expect(next.disabled).toBe(false);
    fireEvent.click(next);
    expect(mocks.useBuyerCarts).toHaveBeenLastCalledWith(2, 20);

    mocks.cartsQuery = {
      data: { page: 2, limit: 20, items: [cart("seller-a", "Produto real", "12345")] },
      isPending: false,
      isError: false,
    };
    rerender(<CarrinhoPage />);
    expect(screen.queryByText("Seu carrinho está vazio")).toBeNull();
    expect(screen.getByText("Loja A")).toBeTruthy();
    expect(screen.getByText("Produto real")).toBeTruthy();
  });

  it("renders one real seller cart", () => {
    mocks.cartsQuery = {
      data: { page: 1, limit: 20, items: [cart("seller-a", "Produto A", "12345")] },
      isPending: false,
      isError: false,
    };
    render(<CarrinhoPage />);
    expect(screen.getByText("Loja A")).toBeTruthy();
    expect(screen.getByText("Produto A")).toBeTruthy();
    expect(screen.getByTestId("subtotal-seller-a").textContent).toBe("R$ 123,45");
  });

  it("keeps seller items and authoritative subtotals isolated without a global total", () => {
    mocks.cartsQuery = {
      data: {
        page: 1,
        limit: 20,
        items: [
          cart("seller-a", "Produto exclusivo A", "1000"),
          cart("seller-b", "Produto exclusivo B", "2500"),
        ],
      },
      isPending: false,
      isError: false,
    };
    render(<CarrinhoPage />);

    const sellerA = within(screen.getByTestId("seller-cart-seller-a"));
    const sellerB = within(screen.getByTestId("seller-cart-seller-b"));
    expect(sellerA.getByText("Produto exclusivo A")).toBeTruthy();
    expect(sellerA.queryByText("Produto exclusivo B")).toBeNull();
    expect(sellerB.getByText("Produto exclusivo B")).toBeTruthy();
    expect(sellerB.queryByText("Produto exclusivo A")).toBeNull();
    expect(screen.getByTestId("subtotal-seller-a").textContent).toBe("R$ 10,00");
    expect(screen.getByTestId("subtotal-seller-b").textContent).toBe("R$ 25,00");
    expect(screen.queryByText("R$ 35,00")).toBeNull();
    expect(sellerA.getByRole("link", { name: "Ir para checkout" }).getAttribute("href")).toBe(
      "/checkout?sellerSlug=seller-a",
    );
    expect(sellerB.getByRole("link", { name: "Ir para checkout" }).getAttribute("href")).toBe(
      "/checkout?sellerSlug=seller-b",
    );
    expect(screen.getAllByRole("link", { name: "Ir para checkout" })).toHaveLength(2);
    expect(screen.queryByText("R$ 35,00")).toBeNull();
  });

  it("offers the next page for a full response and queries page two after the click", () => {
    mocks.cartsQuery = {
      data: {
        page: 1,
        limit: 20,
        items: Array.from({ length: 20 }, (_, index) =>
          cart(`seller-${index}`, `Produto ${index}`, "100"),
        ),
      },
      isPending: false,
      isError: false,
    };
    render(<CarrinhoPage />);

    const next = screen.getByRole("button", { name: "Próxima" }) as HTMLButtonElement;
    expect(next.disabled).toBe(false);
    fireEvent.click(next);
    expect(mocks.useBuyerCarts).toHaveBeenLastCalledWith(2, 20);
    expect(screen.getByText("Página 2")).toBeTruthy();
  });

  it("disables next for a partial page", () => {
    mocks.cartsQuery = {
      data: { page: 1, limit: 20, items: [cart("seller-a", "Produto A", "100")] },
      isPending: false,
      isError: false,
    };
    render(<CarrinhoPage />);
    expect((screen.getByRole("button", { name: "Próxima" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it("returns from page two to page one", () => {
    mocks.cartsQuery = {
      data: {
        page: 1,
        limit: 20,
        items: Array.from({ length: 20 }, (_, index) =>
          cart(`seller-${index}`, `Produto ${index}`, "100"),
        ),
      },
      isPending: false,
      isError: false,
    };
    render(<CarrinhoPage />);
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    fireEvent.click(screen.getByRole("button", { name: "Anterior" }));
    expect(mocks.useBuyerCarts).toHaveBeenLastCalledWith(1, 20);
    expect(screen.getByText("Página 1")).toBeTruthy();
  });

  it("distinguishes an empty later page and lets the buyer return", () => {
    mocks.cartsQuery = {
      data: {
        page: 1,
        limit: 20,
        items: Array.from({ length: 20 }, (_, index) =>
          cart(`seller-${index}`, `Produto ${index}`, "100"),
        ),
      },
      isPending: false,
      isError: false,
    };
    const { rerender } = render(<CarrinhoPage />);
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));

    mocks.cartsQuery = {
      data: { page: 2, limit: 20, items: [] },
      isPending: false,
      isError: false,
    };
    rerender(<CarrinhoPage />);
    expect(screen.getByText("Não há carrinhos nesta página.")).toBeTruthy();
    expect(screen.queryByText("Seu carrinho está vazio")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Voltar para a página anterior" }));
    expect(mocks.useBuyerCarts).toHaveBeenLastCalledWith(1, 20);
  });
});
