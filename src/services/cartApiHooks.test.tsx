import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import { cartApiService, type BuyerCart } from "./cartApiService";
import {
  buyerCartKeys,
  useAddBuyerCartItem,
  useBuyerCarts,
  useBuyerSellerCart,
  useRemoveBuyerCartItem,
  useUpdateBuyerCartItem,
} from "./cartApiHooks";

const auth = vi.hoisted(() => ({ status: "anonymous" }));

vi.mock("@/providers/AuthContext", () => ({
  useAuth: () => auth,
}));

const cart = (sellerSlug: string, version = 2): BuyerCart => ({
  id: `cart-${sellerSlug}`,
  status: "ACTIVE",
  version,
  currency: "BRL",
  seller: { slug: sellerSlug, storeName: sellerSlug },
  items: [],
  previewSubtotalMinor: "0",
  checkoutReady: false,
  previewFingerprint: `fingerprint-${version}`,
  buyerVipPreviewFingerprints: { NONE: "fp-none", BASIC: "fp-basic", PREMIUM: "fp-premium" },
  buyerVipOptions: {
    NONE: {
      plan: "NONE",
      percentBps: 0,
      feeAmountMinor: "0",
      totalAmountMinor: "2500",
      fingerprint: "fp-none",
    },
    BASIC: {
      plan: "BASIC",
      percentBps: 299,
      feeAmountMinor: "74",
      totalAmountMinor: "2574",
      fingerprint: "fp-basic",
    },
    PREMIUM: {
      plan: "PREMIUM",
      percentBps: 499,
      feeAmountMinor: "124",
      totalAmountMinor: "2624",
      fingerprint: "fp-premium",
    },
  },
  createdAt: "2026-08-10T00:00:00.000Z",
  updatedAt: "2026-08-10T00:00:00.000Z",
});

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
}

beforeEach(() => {
  auth.status = "anonymous";
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("buyer cart query state", () => {
  it.each(["initializing", "anonymous"] as const)(
    "does not list carts while auth is %s",
    async (status) => {
      auth.status = status;
      const list = vi.spyOn(cartApiService, "listCarts").mockResolvedValue({
        page: 1,
        limit: 20,
        items: [],
      });

      renderHook(() => useBuyerCarts(), { wrapper: setup().wrapper });
      await act(async () => Promise.resolve());

      expect(list).not.toHaveBeenCalled();
    },
  );

  it("lists carts with API defaults once authenticated", async () => {
    auth.status = "authenticated";
    const list = vi.spyOn(cartApiService, "listCarts").mockResolvedValue({
      page: 1,
      limit: 20,
      items: [],
    });

    const { result } = renderHook(() => useBuyerCarts(), { wrapper: setup().wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(list).toHaveBeenCalledWith(1, 20);
  });

  it("uses pagination and seller slugs as distinct cache key dimensions", () => {
    expect(buyerCartKeys.list(1, 20)).not.toEqual(buyerCartKeys.list(2, 20));
    expect(buyerCartKeys.list(1, 20)).not.toEqual(buyerCartKeys.list(1, 50));
    expect(buyerCartKeys.seller("seller-a")).not.toEqual(buyerCartKeys.seller("seller-b"));
  });

  it("gets the requested seller cart and disables an empty slug", async () => {
    auth.status = "authenticated";
    const getCart = vi.spyOn(cartApiService, "getCart").mockResolvedValue(cart("seller-a"));
    const first = renderHook(() => useBuyerSellerCart("seller-a"), {
      wrapper: setup().wrapper,
    });
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true));
    expect(getCart).toHaveBeenCalledWith("seller-a");

    renderHook(() => useBuyerSellerCart(""), { wrapper: setup().wrapper });
    await act(async () => Promise.resolve());
    expect(getCart).toHaveBeenCalledTimes(1);
  });

  it("stores the authoritative add response, invalidates lists, and isolates sellers", async () => {
    const { queryClient, wrapper } = setup();
    const sellerB = cart("seller-b", 8);
    queryClient.setQueryData(buyerCartKeys.seller("seller-b"), sellerB);
    queryClient.setQueryData(buyerCartKeys.list(1, 20), { page: 1, limit: 20, items: [] });
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const returned = cart("seller-a", 4);
    const input = { productId: "product-id", quantity: 3, expectedVersion: 3 };
    const add = vi.spyOn(cartApiService, "addCartItem").mockResolvedValue(returned);
    const { result } = renderHook(() => useAddBuyerCartItem(), { wrapper });

    await act(() => result.current.mutateAsync({ sellerSlug: "seller-a", input }));

    expect(add).toHaveBeenCalledWith("seller-a", input);
    expect(add.mock.calls[0][1]).toBe(input);
    expect(queryClient.getQueryData(buyerCartKeys.seller("seller-a"))).toBe(returned);
    expect(queryClient.getQueryData(buyerCartKeys.seller("seller-b"))).toBe(sellerB);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: buyerCartKeys.lists() });
  });

  it("forwards update and remove inputs without changing expectedVersion", async () => {
    const { wrapper } = setup();
    const updateInput = { quantity: 5, expectedVersion: 11 };
    const removeInput = { expectedVersion: 12 };
    const update = vi.spyOn(cartApiService, "updateCartItem").mockResolvedValue(cart("seller", 12));
    const remove = vi.spyOn(cartApiService, "removeCartItem").mockResolvedValue(cart("seller", 13));
    const updateHook = renderHook(() => useUpdateBuyerCartItem(), { wrapper });
    const removeHook = renderHook(() => useRemoveBuyerCartItem(), { wrapper });

    await act(() =>
      updateHook.result.current.mutateAsync({
        sellerSlug: "seller",
        itemId: "item",
        input: updateInput,
      }),
    );
    await act(() =>
      removeHook.result.current.mutateAsync({
        sellerSlug: "seller",
        itemId: "item",
        input: removeInput,
      }),
    );

    expect(update).toHaveBeenCalledWith("seller", "item", updateInput);
    expect(update.mock.calls[0][2]).toBe(updateInput);
    expect(remove).toHaveBeenCalledWith("seller", "item", removeInput);
    expect(remove.mock.calls[0][2]).toBe(removeInput);
  });

  it("exposes a cart version conflict unchanged and does not retry", async () => {
    const conflict = new ApiError(
      409,
      "CART_VERSION_CONFLICT",
      "CART_VERSION_CONFLICT",
      "request-id",
      [{ currentVersion: 10 }],
    );
    const remove = vi.spyOn(cartApiService, "removeCartItem").mockRejectedValue(conflict);
    const { result } = renderHook(() => useRemoveBuyerCartItem(), { wrapper: setup().wrapper });

    let received: unknown;
    await act(async () => {
      received = await result.current
        .mutateAsync({ sellerSlug: "seller", itemId: "item", input: { expectedVersion: 9 } })
        .catch((error: unknown) => error);
    });

    expect(received).toBe(conflict);
    expect(received).toMatchObject({
      status: 409,
      code: "CART_VERSION_CONFLICT",
      requestId: "request-id",
      details: [{ currentVersion: 10 }],
    });
    expect(remove).toHaveBeenCalledTimes(1);
  });
});
