import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, setAccessToken } from "@/lib/api/client";
import { cartApiService } from "./cartApiService";

const cart = {
  id: "cart-id",
  status: "ACTIVE",
  version: 7,
  currency: "BRL",
  seller: { slug: "seller", storeName: "Seller" },
  items: [
    {
      id: "item-id",
      quantity: 2,
      product: {
        id: "product-id",
        slug: "product",
        title: "Product",
        model: "NORMAL",
      },
      variant: null,
      currentUnitAmountMinor: "9000",
      currentLineAmountMinor: "18000",
      purchasable: false,
      issues: ["OUT_OF_STOCK"],
    },
  ],
  previewSubtotalMinor: "18000",
  checkoutReady: false,
  previewFingerprint: "sha256:fingerprint",
  createdAt: "2026-08-10T00:00:00.000Z",
  updatedAt: "2026-08-10T00:01:00.000Z",
};

function mockOk(payload: unknown = cart) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(payload), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function request(fetchMock: ReturnType<typeof mockOk>) {
  const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
  return { url: String(url), init, body: init.body ? JSON.parse(String(init.body)) : undefined };
}

afterEach(() => {
  setAccessToken(null);
  vi.unstubAllGlobals();
});

describe("cartApiService", () => {
  it("lists carts using the backend pagination query", async () => {
    const fetchMock = mockOk({ page: 3, limit: 12, items: [cart] });

    await expect(cartApiService.listCarts(3, 12)).resolves.toMatchObject({ page: 3, limit: 12 });

    expect(request(fetchMock)).toMatchObject({
      url: "http://localhost:3001/api/v1/carts?page=3&limit=12",
      init: { method: "GET", credentials: "include" },
    });
  });

  it("gets a seller cart with an encoded slug and preserves its contract fields", async () => {
    const fetchMock = mockOk();

    const result = await cartApiService.getCart("seller/name ?");

    expect(request(fetchMock).url).toBe("http://localhost:3001/api/v1/carts/seller%2Fname%20%3F");
    expect(result).toMatchObject({
      version: 7,
      previewSubtotalMinor: "18000",
      previewFingerprint: "sha256:fingerprint",
      items: [
        {
          currentUnitAmountMinor: "9000",
          currentLineAmountMinor: "18000",
          purchasable: false,
          issues: ["OUT_OF_STOCK"],
        },
      ],
    });
    expect(typeof result.previewSubtotalMinor).toBe("string");
    expect(typeof result.items[0].currentUnitAmountMinor).toBe("string");
  });

  it("adds an item with only the supported mutation fields", async () => {
    const fetchMock = mockOk();
    const input = {
      productId: "product-id",
      productVariantId: "variant-id",
      quantity: 2,
      expectedVersion: 7,
      ignored: "not-sent",
    };

    await cartApiService.addCartItem("seller", input);

    expect(request(fetchMock)).toMatchObject({
      url: "http://localhost:3001/api/v1/carts/seller/items",
      init: { method: "POST" },
      body: {
        productId: "product-id",
        productVariantId: "variant-id",
        quantity: 2,
        expectedVersion: 7,
      },
    });
    expect(Object.keys(request(fetchMock).body)).toEqual([
      "productId",
      "productVariantId",
      "quantity",
      "expectedVersion",
    ]);
  });

  it("omits an absent variant when adding an item", async () => {
    const fetchMock = mockOk();
    await cartApiService.addCartItem("seller", {
      productId: "product-id",
      quantity: 1,
      expectedVersion: 0,
    });
    expect(request(fetchMock).body).toEqual({
      productId: "product-id",
      quantity: 1,
      expectedVersion: 0,
    });
  });

  it("updates the encoded item with quantity and expected version", async () => {
    const fetchMock = mockOk();

    await cartApiService.updateCartItem("seller", "item/id", {
      quantity: 4,
      expectedVersion: 8,
    });

    expect(request(fetchMock)).toMatchObject({
      url: "http://localhost:3001/api/v1/carts/seller/items/item%2Fid",
      init: { method: "PATCH" },
      body: { quantity: 4, expectedVersion: 8 },
    });
  });

  it("removes an item with expected version through the existing CSRF flow", async () => {
    document.cookie = "litbuy_csrf=csrf%20token";
    const fetchMock = mockOk();

    await cartApiService.removeCartItem("seller", "item-id", { expectedVersion: 9 });

    const sent = request(fetchMock);
    expect(sent).toMatchObject({
      url: "http://localhost:3001/api/v1/carts/seller/items/item-id",
      init: { method: "DELETE", credentials: "include" },
      body: { expectedVersion: 9 },
    });
    expect((sent.init.headers as Headers).get("X-CSRF-Token")).toBe("csrf token");
  });

  it("preserves a structured cart version conflict for the caller", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              statusCode: 409,
              code: "CART_VERSION_CONFLICT",
              message: "CART_VERSION_CONFLICT",
              details: [{ currentVersion: 10 }],
              requestId: "request-id",
            }),
            { status: 409 },
          ),
      ),
    );

    await expect(
      cartApiService.removeCartItem("seller", "item-id", { expectedVersion: 9 }),
    ).rejects.toMatchObject({
      status: 409,
      code: "CART_VERSION_CONFLICT",
      details: [{ currentVersion: 10 }],
      requestId: "request-id",
    } satisfies Partial<ApiError>);
  });
});
