import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import type { BuyerCart } from "@/services/cartApiService";
import { BuyerCartSellerSection } from "./BuyerCartSellerSection";

const mocks = vi.hoisted(() => ({
  updateMutate: vi.fn(),
  removeMutate: vi.fn(),
  refetch: vi.fn(),
  synchronizedData: undefined as BuyerCart | undefined,
  updatePending: false,
  removePending: false,
}));

vi.mock("@tanstack/react-router", () => ({
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
vi.mock("@/services/cartApiHooks", () => ({
  useBuyerSellerCart: () => ({ data: mocks.synchronizedData, refetch: mocks.refetch }),
  useUpdateBuyerCartItem: () => ({ mutate: mocks.updateMutate, isPending: mocks.updatePending }),
  useRemoveBuyerCartItem: () => ({ mutate: mocks.removeMutate, isPending: mocks.removePending }),
}));

const cart = (overrides: Partial<BuyerCart> = {}): BuyerCart => ({
  id: "cart-a",
  status: "ACTIVE",
  version: 17,
  currency: "BRL",
  seller: { slug: "seller-a", storeName: "Loja A" },
  items: [
    {
      id: "item-a",
      quantity: 2,
      product: { id: "product-a", slug: "produto-a", title: "Produto A", model: "DYNAMIC" },
      variant: { id: "variant-a", title: "Azul" },
      currentUnitAmountMinor: "12345",
      currentLineAmountMinor: "24690",
      purchasable: true,
      issues: [],
    },
  ],
  previewSubtotalMinor: "24690",
  checkoutReady: true,
  previewFingerprint: "fingerprint",
  createdAt: "2026-08-10",
  updatedAt: "2026-08-10",
  ...overrides,
});

beforeEach(() => {
  mocks.updateMutate.mockReset();
  mocks.removeMutate.mockReset();
  mocks.refetch.mockReset();
  mocks.synchronizedData = undefined;
  mocks.updatePending = false;
  mocks.removePending = false;
});

describe("BuyerCartSellerSection", () => {
  it("links each ready seller only to its own single-seller checkout", () => {
    const { rerender } = render(<BuyerCartSellerSection cart={cart()} />);
    expect(screen.getByRole("link", { name: "Ir para checkout" }).getAttribute("href")).toBe(
      "/checkout?sellerSlug=seller-a",
    );
    rerender(
      <BuyerCartSellerSection
        cart={cart({ id: "cart-b", seller: { slug: "seller-b", storeName: "Loja B" } })}
      />,
    );
    expect(screen.getByRole("link", { name: "Ir para checkout" }).getAttribute("href")).toBe(
      "/checkout?sellerSlug=seller-b",
    );
  });

  it("does not expose checkout when the seller cart is not ready", () => {
    render(<BuyerCartSellerSection cart={cart({ checkoutReady: false })} />);
    expect(screen.queryByRole("link", { name: "Ir para checkout" })).toBeNull();
    expect(screen.getByText("Ajuste os itens deste carrinho para continuar.")).toBeTruthy();
  });
  it("fails closed instead of exposing checkout for a defensive multi-line response", () => {
    render(
      <BuyerCartSellerSection
        cart={cart({ items: [cart().items[0], { ...cart().items[0], id: "item-b" }] })}
      />,
    );
    expect(screen.queryByRole("link", { name: "Ir para checkout" })).toBeNull();
    expect(screen.getByText(/seleção inválida/)).toBeTruthy();
  });
  it("keeps a newer listed cart instead of stale seller cache data", () => {
    const listed = cart({ version: 20, items: [{ ...cart().items[0], quantity: 4 }] });
    mocks.synchronizedData = cart({ version: 18, items: [{ ...cart().items[0], quantity: 2 }] });

    render(<BuyerCartSellerSection cart={listed} />);
    expect(screen.getByText("4")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Aumentar quantidade de Produto A" }));
    expect(mocks.updateMutate.mock.calls[0][0].input).toEqual({
      quantity: 5,
      expectedVersion: 20,
    });
  });

  it("uses a strictly newer synchronized version of the same cart", () => {
    const listed = cart({ version: 20, items: [{ ...cart().items[0], quantity: 4 }] });
    mocks.synchronizedData = cart({ version: 21, items: [{ ...cart().items[0], quantity: 5 }] });

    render(<BuyerCartSellerSection cart={listed} />);
    expect(screen.getByText("5")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Aumentar quantidade de Produto A" }));
    expect(mocks.updateMutate.mock.calls[0][0].input).toEqual({
      quantity: 6,
      expectedVersion: 21,
    });
  });

  it("does not replace the listed cart with cached data from another cart id", () => {
    const listed = cart({ version: 20, items: [{ ...cart().items[0], quantity: 4 }] });
    mocks.synchronizedData = cart({
      id: "cart-other",
      version: 21,
      items: [{ ...cart().items[0], quantity: 5 }],
    });

    render(<BuyerCartSellerSection cart={listed} />);
    expect(screen.getByText("4")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Aumentar quantidade de Produto A" }));
    expect(mocks.updateMutate.mock.calls[0][0].input.expectedVersion).toBe(20);
  });

  it("sends seller, item, quantity, and the cart expectedVersion unchanged", () => {
    render(<BuyerCartSellerSection cart={cart()} />);
    fireEvent.click(screen.getByRole("button", { name: "Aumentar quantidade de Produto A" }));
    expect(mocks.updateMutate).toHaveBeenCalledWith(
      {
        sellerSlug: "seller-a",
        itemId: "item-a",
        input: { quantity: 3, expectedVersion: 17 },
      },
      expect.any(Object),
    );
  });

  it("removes only after sending the authoritative seller, item, and version", () => {
    render(<BuyerCartSellerSection cart={cart()} />);
    fireEvent.click(screen.getByRole("button", { name: "Remover" }));
    expect(mocks.removeMutate).toHaveBeenCalledWith(
      { sellerSlug: "seller-a", itemId: "item-a", input: { expectedVersion: 17 } },
      expect.any(Object),
    );
    expect(screen.getByText("Produto A")).toBeTruthy();
  });

  it("does not retry a version conflict, refetches only that seller, and requires manual action", async () => {
    mocks.updateMutate.mockImplementation((_variables, callbacks) =>
      callbacks.onError(new ApiError(409, "CART_VERSION_CONFLICT", "conflict")),
    );
    render(<BuyerCartSellerSection cart={cart()} />);
    fireEvent.click(screen.getByRole("button", { name: "Aumentar quantidade de Produto A" }));

    expect(mocks.updateMutate).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(mocks.refetch).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("status").textContent).toContain("Seu carrinho mudou");
  });

  it("shows backend purchasability issues and never turns null money into zero", () => {
    const unavailable = cart({
      items: [
        {
          ...cart().items[0],
          currentUnitAmountMinor: null,
          currentLineAmountMinor: null,
          purchasable: false,
          issues: ["OUT_OF_STOCK", "VARIANT_UNAVAILABLE"],
        },
      ],
      previewSubtotalMinor: null,
      checkoutReady: false,
    });
    render(<BuyerCartSellerSection cart={unavailable} />);
    expect(screen.getByText("Este item precisa de atenção.")).toBeTruthy();
    expect(screen.getByText("OUT OF STOCK")).toBeTruthy();
    expect(screen.getByText("VARIANT UNAVAILABLE")).toBeTruthy();
    expect(screen.getAllByText("Valor não disponível").length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText("R$ 0,00")).toBeNull();
  });

  it("disables every mutable control for this seller while a mutation is pending", () => {
    mocks.updatePending = true;
    render(<BuyerCartSellerSection cart={cart()} />);
    expect(
      (
        screen.getByRole("button", {
          name: "Aumentar quantidade de Produto A",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      (
        screen.getByRole("button", {
          name: "Diminuir quantidade de Produto A",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect((screen.getByRole("button", { name: "Remover" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });
});
