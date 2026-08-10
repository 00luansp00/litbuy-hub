import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BuyerCart } from "@/services/cartApiService";
import { CarrinhoPage } from "./carrinho";

const mocks = vi.hoisted(() => ({
  authStatus: "authenticated",
  cartsQuery: {} as Record<string, unknown>,
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => options,
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));
vi.mock("@/providers/AuthContext", () => ({
  useAuth: () => ({ status: mocks.authStatus }),
}));
vi.mock("@/providers/CartProvider", () => {
  throw new Error("The real cart route must not import CartProvider");
});
vi.mock("@/services/cartApiHooks", () => ({
  useBuyerCarts: vi.fn(() => mocks.cartsQuery),
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
  createdAt: "2026-08-10",
  updatedAt: "2026-08-10",
});

beforeEach(() => {
  mocks.authStatus = "authenticated";
  mocks.cartsQuery = { data: { page: 1, limit: 20, items: [] }, isPending: false, isError: false };
});

describe("CarrinhoPage", () => {
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

  it("uses the empty state for no carts and carts that are all empty", () => {
    const { rerender } = render(<CarrinhoPage />);
    expect(screen.getByText("Seu carrinho está vazio")).toBeTruthy();

    mocks.cartsQuery = {
      data: { page: 1, limit: 20, items: [cart("seller-a", "Produto A", "0", 0)] },
      isPending: false,
      isError: false,
    };
    rerender(<CarrinhoPage />);
    expect(screen.getByText("Seu carrinho está vazio")).toBeTruthy();
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
    expect(screen.queryByRole("link", { name: /checkout/i })).toBeNull();
  });
});
