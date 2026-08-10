import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import type { BuyerCart } from "@/services/cartApiService";
import type { PublicCatalogProductDetail } from "@/services/publicCatalog";
import { PublicProductPurchasePanel } from "./PublicProductPurchasePanel";

const mocks = vi.hoisted(() => ({
  authStatus: "authenticated",
  cartQuery: {} as Record<string, unknown>,
  mutate: vi.fn(),
  reset: vi.fn(),
  refetch: vi.fn(),
  isPending: false,
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));
vi.mock("@/providers/AuthContext", () => ({
  useAuth: () => ({ status: mocks.authStatus }),
}));
vi.mock("@/services/cartApiHooks", () => ({
  useBuyerSellerCart: () => mocks.cartQuery,
  useAddBuyerCartItem: () => ({
    mutate: mocks.mutate,
    reset: mocks.reset,
    isPending: mocks.isPending,
  }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));

const product = (
  overrides: Partial<PublicCatalogProductDetail> = {},
): PublicCatalogProductDetail => ({
  id: "11111111-1111-4111-8111-111111111111",
  slug: "produto",
  title: "Produto",
  shortDescription: "Resumo",
  description: "Descrição",
  productType: "ITEM",
  model: "NORMAL",
  pricing: { kind: "FIXED", amount: "10.00" },
  stock: 5,
  deliveryMode: "MANUAL",
  category: { slug: "categoria", name: "Categoria" },
  subcategory: null,
  seller: { slug: "loja", storeName: "Loja" },
  coverImage: { url: "https://example.com/image", expiresAt: "2026-08-11", altText: null },
  gallery: [],
  variants: [],
  serviceDetails: null,
  ...overrides,
});

const cart = (version = 7, items: BuyerCart["items"] = []): BuyerCart => ({
  id: "cart",
  status: "ACTIVE",
  version,
  currency: "BRL",
  seller: { slug: "loja", storeName: "Loja" },
  items,
  previewSubtotalMinor: "0",
  checkoutReady: false,
  previewFingerprint: "fingerprint",
  createdAt: "2026-08-10",
  updatedAt: "2026-08-10",
});

const loadedCart = (value: BuyerCart) => ({
  data: value,
  error: null,
  isSuccess: true,
  isError: false,
  isPending: false,
  refetch: mocks.refetch,
});

beforeEach(() => {
  mocks.authStatus = "authenticated";
  mocks.cartQuery = loadedCart(cart());
  mocks.mutate.mockReset();
  mocks.reset.mockReset();
  mocks.refetch.mockReset();
  mocks.isPending = false;
});

describe("PublicProductPurchasePanel", () => {
  it("shows login without allowing an anonymous mutation", () => {
    mocks.authStatus = "anonymous";
    mocks.cartQuery = { isPending: true, refetch: mocks.refetch };
    render(<PublicProductPurchasePanel product={product()} />);

    expect(screen.getByRole("link", { name: "Entrar para comprar" }).getAttribute("href")).toBe(
      "/login",
    );
    expect(screen.queryByRole("button", { name: "Adicionar ao carrinho" })).toBeNull();
    expect(mocks.mutate).not.toHaveBeenCalled();
  });

  it("keeps cart access blocked while authentication initializes", () => {
    mocks.authStatus = "initializing";
    mocks.cartQuery = { isPending: true, refetch: mocks.refetch };
    render(<PublicProductPurchasePanel product={product()} />);
    expect(screen.getByText("Verificando sua sessão…")).toBeTruthy();
    expect(mocks.mutate).not.toHaveBeenCalled();
  });

  it("treats only CART_NOT_FOUND as an absent cart and sends version zero", () => {
    mocks.cartQuery = {
      error: new ApiError(404, "CART_NOT_FOUND", "CART_NOT_FOUND"),
      isSuccess: false,
      isError: true,
      isPending: false,
      refetch: mocks.refetch,
    };
    render(<PublicProductPurchasePanel product={product()} />);
    fireEvent.click(screen.getByRole("button", { name: "Adicionar ao carrinho" }));

    expect(mocks.mutate).toHaveBeenCalledWith(
      {
        sellerSlug: "loja",
        input: {
          productId: "11111111-1111-4111-8111-111111111111",
          quantity: 1,
          expectedVersion: 0,
        },
      },
      expect.any(Object),
    );
  });

  it("uses the existing cart version unchanged", () => {
    mocks.cartQuery = loadedCart(cart(12));
    render(<PublicProductPurchasePanel product={product()} />);
    fireEvent.click(screen.getByRole("button", { name: "Adicionar ao carrinho" }));
    expect(mocks.mutate.mock.calls[0][0].input.expectedVersion).toBe(12);
  });

  it("requires an in-stock DYNAMIC variant and sends its id", () => {
    const dynamic = product({
      model: "DYNAMIC",
      variants: [
        { id: "available", title: "Disponível", description: null, price: "12", stock: 2 },
        { id: "sold-out", title: "Esgotada", description: null, price: "13", stock: 0 },
      ],
    });
    render(<PublicProductPurchasePanel product={dynamic} />);
    const add = screen.getByRole("button", { name: "Adicionar ao carrinho" });
    expect((add as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: /Esgotada/ }) as HTMLButtonElement).disabled).toBe(
      true,
    );

    fireEvent.click(screen.getByRole("button", { name: /Disponível/ }));
    expect((add as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(add);
    expect(mocks.mutate.mock.calls[0][0].input).toMatchObject({
      productVariantId: "available",
      quantity: 1,
      expectedVersion: 7,
    });
  });

  it("allows a fixed-price SERVICE with quantity one and no variant", () => {
    render(
      <PublicProductPurchasePanel
        product={product({
          model: "SERVICE",
          productType: "SERVICE",
          serviceDetails: { pricingType: "FIXED", basePrice: "25", estimatedDelivery: "2 dias" },
        })}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Adicionar ao carrinho" }));
    expect(mocks.mutate.mock.calls[0][0].input).toEqual({
      productId: "11111111-1111-4111-8111-111111111111",
      quantity: 1,
      expectedVersion: 7,
    });
  });

  it("explains quote pricing without offering or running add", () => {
    render(
      <PublicProductPurchasePanel
        product={product({
          model: "SERVICE",
          productType: "SERVICE",
          pricing: { kind: "QUOTE", amount: null },
          serviceDetails: {
            pricingType: "QUOTE",
            basePrice: null,
            estimatedDelivery: "A combinar",
          },
        })}
      />,
    );
    expect(screen.getByText("Este serviço exige orçamento antes da compra.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Adicionar ao carrinho" })).toBeNull();
    expect(mocks.mutate).not.toHaveBeenCalled();
  });

  it("blocks a duplicate product and does not POST again", () => {
    mocks.cartQuery = loadedCart(
      cart(4, [
        {
          id: "item",
          quantity: 1,
          product: { id: product().id, slug: "produto", title: "Produto", model: "NORMAL" },
          variant: null,
          currentUnitAmountMinor: "1000",
          currentLineAmountMinor: "1000",
          purchasable: true,
          issues: [],
        },
      ]),
    );
    render(<PublicProductPurchasePanel product={product()} />);
    expect(
      (screen.getByRole("button", { name: "Já está no carrinho" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(mocks.mutate).not.toHaveBeenCalled();
  });

  it("shows authoritative success only after the mutation callback", () => {
    mocks.mutate.mockImplementation((_variables, callbacks) => callbacks.onSuccess());
    render(<PublicProductPurchasePanel product={product()} />);
    fireEvent.click(screen.getByRole("button", { name: "Adicionar ao carrinho" }));
    expect(screen.getByRole("status").textContent).toContain("Produto adicionado ao carrinho.");
  });

  it("does not retry a version conflict, refetches, and asks for a manual attempt", async () => {
    mocks.mutate.mockImplementation((_variables, callbacks) =>
      callbacks.onError(new ApiError(409, "CART_VERSION_CONFLICT", "conflict")),
    );
    render(<PublicProductPurchasePanel product={product()} />);
    fireEvent.click(screen.getByRole("button", { name: "Adicionar ao carrinho" }));

    expect(mocks.mutate).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(mocks.refetch).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("status").textContent).toContain(
      "Seu carrinho mudou. Sincronizamos os dados; tente novamente.",
    );
  });

  it("does not treat another cart loading failure as an empty cart", () => {
    mocks.cartQuery = {
      error: new ApiError(500, "INTERNAL_ERROR", "failure"),
      isSuccess: false,
      isError: true,
      isPending: false,
      refetch: mocks.refetch,
    };
    render(<PublicProductPurchasePanel product={product()} />);
    expect(screen.getByRole("alert").textContent).toContain("Não foi possível sincronizar");
    expect(screen.queryByRole("button", { name: "Adicionar ao carrinho" })).toBeNull();
    expect(mocks.mutate).not.toHaveBeenCalled();
  });
});
