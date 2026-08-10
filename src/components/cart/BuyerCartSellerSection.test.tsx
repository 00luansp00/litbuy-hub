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
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
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
