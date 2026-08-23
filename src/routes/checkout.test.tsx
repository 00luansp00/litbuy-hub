import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import type { BuyerCart } from "@/services/cartApiService";

const mocks = vi.hoisted(() => ({
  cartQuery: {} as Record<string, unknown>,
  mutate: vi.fn(),
  createPending: false,
  refetch: vi.fn(),
  invalidateQueries: vi.fn(async () => undefined),
  navigate: vi.fn(),
  search: {} as { sellerSlug?: string },
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({
    ...options,
    useSearch: () => mocks.search,
  }),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
  useNavigate: () => mocks.navigate,
}));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
}));
vi.mock("@/components/auth/AuthGate", () => ({
  AuthGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/checkout/CheckoutLayout", () => ({
  CheckoutLayout: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));
vi.mock("@/services/cartApiHooks", () => ({
  buyerCartKeys: { all: ["buyer-carts"] },
  useBuyerSellerCart: () => mocks.cartQuery,
}));
vi.mock("@/services/checkoutApiHooks", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/checkoutApiHooks")>();
  return {
    ...actual,
    useCreateCheckoutSession: () => ({ mutate: mocks.mutate, isPending: mocks.createPending }),
  };
});
vi.mock("@/services/orders", () => ({
  buyerOrderKeys: {
    all: ["buyer-orders"],
    detail: (code: string) => ["buyer-order", code],
  },
}));

import { CheckoutContent, ChooseCart, parseCheckoutSellerSlug } from "./checkout";

const readyCart = (overrides: Partial<BuyerCart> = {}): BuyerCart => ({
  id: "cart-a",
  status: "ACTIVE",
  version: 12,
  currency: "BRL",
  seller: { slug: "loja-a", storeName: "Loja A" },
  items: [
    {
      id: "item-a",
      quantity: 2,
      product: { id: "product-a", slug: "produto-a", title: "Produto real", model: "NORMAL" },
      variant: { id: "variant-a", title: "Variante Azul" },
      currentUnitAmountMinor: "12345",
      currentLineAmountMinor: "24690",
      purchasable: true,
      issues: [],
    },
  ],
  previewSubtotalMinor: "24690",
  checkoutReady: true,
  previewFingerprint: "fingerprint-a",
  buyerVipPreviewFingerprints: {
    NONE: "fingerprint-none",
    BASIC: "fingerprint-basic",
    PREMIUM: "fingerprint-premium",
  },
  buyerVipOptions: {
    NONE: {
      plan: "NONE",
      percentBps: 0,
      feeAmountMinor: "0",
      totalAmountMinor: "24690",
      fingerprint: "fingerprint-none",
    },
    BASIC: {
      plan: "BASIC",
      percentBps: 299,
      feeAmountMinor: "738",
      totalAmountMinor: "25428",
      fingerprint: "fingerprint-basic",
    },
    PREMIUM: {
      plan: "PREMIUM",
      percentBps: 499,
      feeAmountMinor: "1232",
      totalAmountMinor: "25922",
      fingerprint: "fingerprint-premium",
    },
  },
  createdAt: "2026-08-10T00:00:00.000Z",
  updatedAt: "2026-08-10T00:00:00.000Z",
  ...overrides,
});

function setCart(data: BuyerCart = readyCart()) {
  mocks.cartQuery = {
    data,
    isPending: false,
    isError: false,
    refetch: mocks.refetch,
  };
}

function confirm() {
  fireEvent.click(screen.getByRole("radio", { name: "Sem plano" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirmar e criar pedido" }));
}

beforeEach(() => {
  mocks.mutate.mockReset();
  mocks.refetch.mockReset();
  mocks.invalidateQueries.mockClear();
  mocks.navigate.mockReset();
  mocks.createPending = false;
  mocks.search = {};
  setCart();
});

describe("checkout seller search", () => {
  it("accepts only the backend-compatible seller slug", () => {
    expect(parseCheckoutSellerSlug("loja-a")).toBe("loja-a");
    for (const invalid of [undefined, "Loja-A", "loja_a", "-loja", "loja-", " loja-a "])
      expect(parseCheckoutSellerSlug(invalid)).toBeUndefined();
  });

  it("shows the safe cart chooser when no valid seller was selected", () => {
    render(<ChooseCart />);
    expect(screen.getByText("Escolha um carrinho para continuar")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Voltar ao carrinho" }).getAttribute("href")).toBe(
      "/carrinho",
    );
  });
});

describe("CheckoutContent real cart states", () => {
  it("shows loading and error without offering order creation", () => {
    mocks.cartQuery = { isPending: true, isError: false, refetch: mocks.refetch };
    const { rerender } = render(<CheckoutContent sellerSlug="loja-a" />);
    expect(screen.getByText("Carregando carrinho…")).toBeTruthy();

    mocks.cartQuery = { isPending: false, isError: true, refetch: mocks.refetch };
    rerender(<CheckoutContent sellerSlug="loja-a" />);
    expect(screen.queryByRole("button", { name: /criar pedido/i })).toBeNull();
    expect(screen.getByRole("link", { name: "Voltar ao carrinho" })).toBeTruthy();
  });

  it("does not create an order for an empty or not-ready cart", () => {
    setCart(readyCart({ items: [], checkoutReady: false }));
    const { rerender } = render(<CheckoutContent sellerSlug="loja-a" />);
    expect(screen.queryByRole("button", { name: /criar pedido/i })).toBeNull();

    setCart(readyCart({ checkoutReady: false }));
    rerender(<CheckoutContent sellerSlug="loja-a" />);
    const button = screen.getByRole("button", { name: "Confirmar e criar pedido" });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(button);
    expect(mocks.mutate).not.toHaveBeenCalled();
  });

  it("fails closed for a defensive multi-line cart", () => {
    setCart(
      readyCart({ items: [readyCart().items[0], { ...readyCart().items[0], id: "item-b" }] }),
    );
    render(<CheckoutContent sellerSlug="loja-a" />);
    expect(screen.getByRole("alert").textContent).toContain("somente um produto ou variante");
    expect(screen.queryByRole("button", { name: /criar pedido/i })).toBeNull();
    expect(mocks.mutate).not.toHaveBeenCalled();
  });

  it("renders the authoritative seller, item, issue, variant, quantity, and minor-unit money", () => {
    setCart(
      readyCart({
        items: [{ ...readyCart().items[0], issues: ["INSUFFICIENT_STOCK"], purchasable: false }],
      }),
    );
    render(<CheckoutContent sellerSlug="loja-a" />);
    expect(screen.getByText("Loja A")).toBeTruthy();
    expect(screen.getByText("Produto real")).toBeTruthy();
    expect(screen.getByText("Variante: Variante Azul")).toBeTruthy();
    expect(screen.getByText("Quantidade: 2")).toBeTruthy();
    expect(screen.getAllByText("R$ 246,90")).toHaveLength(2);
    expect(screen.getByText("R$ 123,45 por unidade")).toBeTruthy();
    expect(screen.getByText("INSUFFICIENT STOCK")).toBeTruthy();
  });

  it("never fabricates zero money for unavailable values", () => {
    setCart(
      readyCart({
        previewSubtotalMinor: null,
        checkoutReady: false,
        items: [
          {
            ...readyCart().items[0],
            currentUnitAmountMinor: null,
            currentLineAmountMinor: null,
          },
        ],
      }),
    );
    render(<CheckoutContent sellerSlug="loja-a" />);
    expect(screen.getAllByText(/Valor indisponível/)).toHaveLength(3);
    expect(screen.queryByText("R$ 0,00")).toBeNull();
  });
});

describe("CheckoutContent creation", () => {
  it("starts unselected and requires a conscious Buyer VIP choice", () => {
    render(<CheckoutContent sellerSlug="loja-a" />);
    expect((screen.getByRole("radio", { name: "Sem plano" }) as HTMLInputElement).checked).toBe(
      false,
    );
    expect((screen.getByRole("radio", { name: "VIP Básico" }) as HTMLInputElement).checked).toBe(
      false,
    );
    expect((screen.getByRole("radio", { name: "VIP Premium" }) as HTMLInputElement).checked).toBe(
      false,
    );
    expect(
      (screen.getByRole("button", { name: "Confirmar e criar pedido" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
  it("derives the exact commercial intent from the cart", () => {
    render(<CheckoutContent sellerSlug="loja-a" />);
    confirm();
    const input = mocks.mutate.mock.calls[0][0];
    expect(input).toEqual({
      sellerSlug: "loja-a",
      expectedCartVersion: 12,
      buyerVipPlan: "NONE",
      expectedPreviewFingerprint: "fingerprint-none",
      idempotencyKey: expect.stringMatching(/^checkout:/),
    });
    expect(input).not.toHaveProperty("price");
    expect(input).not.toHaveProperty("subtotal");
    expect(input).not.toHaveProperty("total");
    expect(input).not.toHaveProperty("items");
    expect(input).not.toHaveProperty("paymentMethod");
    expect(input).not.toHaveProperty("coupon");
    expect(input).not.toHaveProperty("protection");
  });

  it("blocks a concurrent double submit while pending", () => {
    mocks.createPending = true;
    render(<CheckoutContent sellerSlug="loja-a" />);
    const button = screen.getByRole("button", { name: "Criando pedido…" });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(button);
    expect(mocks.mutate).not.toHaveBeenCalled();
  });

  it("reuses the key for the same intent and changes it after cart version or fingerprint changes", () => {
    const { rerender } = render(<CheckoutContent sellerSlug="loja-a" />);
    confirm();
    const first = mocks.mutate.mock.calls[0][0].idempotencyKey;
    confirm();
    expect(mocks.mutate.mock.calls[1][0].idempotencyKey).toBe(first);

    setCart(readyCart({ version: 13 }));
    rerender(<CheckoutContent sellerSlug="loja-a" />);
    confirm();
    expect(mocks.mutate.mock.calls[2][0].idempotencyKey).not.toBe(first);

    setCart(
      readyCart({
        version: 12,
        previewFingerprint: "fingerprint-b",
        buyerVipPreviewFingerprints: {
          NONE: "fingerprint-none-b",
          BASIC: "fingerprint-basic-b",
          PREMIUM: "fingerprint-premium-b",
        },
        buyerVipOptions: {
          ...readyCart().buyerVipOptions,
          NONE: { ...readyCart().buyerVipOptions.NONE, fingerprint: "fingerprint-none-b" },
        },
      }),
    );
    rerender(<CheckoutContent sellerSlug="loja-a" />);
    confirm();
    expect(mocks.mutate.mock.calls[3][0].idempotencyKey).not.toBe(first);
  });

  it.each([
    ["CART_VERSION_CONFLICT", "Seu carrinho mudou"],
    ["CHECKOUT_PREVIEW_CHANGED", "O preço ou a seleção mudou"],
    ["INSUFFICIENT_STOCK", "O estoque mudou"],
  ])("shows %s, refetches, and never retries or navigates", async (code, feedback) => {
    render(<CheckoutContent sellerSlug="loja-a" />);
    confirm();
    act(() => mocks.mutate.mock.calls[0][1].onError(new ApiError(409, code, code)));
    expect(screen.getByRole("alert").textContent).toContain(feedback);
    expect(mocks.refetch).toHaveBeenCalledTimes(1);
    expect(mocks.mutate).toHaveBeenCalledTimes(1);
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it("does not fabricate success for CHECKOUT_CONFLICT and links to existing orders", () => {
    render(<CheckoutContent sellerSlug="loja-a" />);
    confirm();
    act(() =>
      mocks.mutate.mock.calls[0][1].onError(
        new ApiError(409, "CHECKOUT_CONFLICT", "CHECKOUT_CONFLICT"),
      ),
    );
    expect(screen.getByRole("alert").textContent).toContain("Confira seus pedidos");
    expect(screen.getByRole("link", { name: "Conferir pedidos" }).getAttribute("href")).toBe(
      "/pedidos",
    );
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it("invalidates real caches and navigates only to the real order after success", async () => {
    render(<CheckoutContent sellerSlug="loja-a" />);
    confirm();
    await act(async () => {
      await mocks.mutate.mock.calls[0][1].onSuccess({ orderCode: "LIT-23456789ABCDEFG" });
    });
    await waitFor(() => expect(mocks.invalidateQueries).toHaveBeenCalledTimes(3));
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["buyer-carts"] });
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["buyer-orders"] });
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["buyer-order", "LIT-23456789ABCDEFG"],
    });
    expect(mocks.navigate).toHaveBeenCalledWith({
      to: "/pedidos/$id",
      params: { id: "LIT-23456789ABCDEFG" },
    });
    expect(mocks.navigate).not.toHaveBeenCalledWith(
      expect.objectContaining({ to: "/pagamento/$id" }),
    );
  });
});
