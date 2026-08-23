import { apiFetch } from "@/lib/api/client";

export type BuyerCartItem = {
  id: string;
  quantity: number;
  product: {
    id: string;
    slug: string;
    title: string;
    model: "NORMAL" | "DYNAMIC" | "SERVICE";
  };
  variant: { id: string; title: string } | null;
  currentUnitAmountMinor: string | null;
  currentLineAmountMinor: string | null;
  purchasable: boolean;
  issues: string[];
};

export type BuyerCart = {
  id: string;
  status: "ACTIVE";
  version: number;
  currency: "BRL";
  seller: { slug: string; storeName: string };
  items: BuyerCartItem[];
  previewSubtotalMinor: string | null;
  checkoutReady: boolean;
  previewFingerprint: string;
  buyerVipPreviewFingerprints: Record<BuyerVipPlan, string>;
  buyerVipOptions: Record<BuyerVipPlan, BuyerVipOption>;
  createdAt: string;
  updatedAt: string;
};

export type BuyerVipPlan = "NONE" | "BASIC" | "PREMIUM";
export type BuyerVipOption = {
  plan: BuyerVipPlan;
  percentBps: number;
  feeAmountMinor: string;
  totalAmountMinor: string;
  fingerprint: string;
};

export type BuyerCartPage = {
  page: number;
  limit: number;
  items: BuyerCart[];
};

export type AddCartItemInput = {
  productId: string;
  productVariantId?: string;
  quantity: number;
  expectedVersion: number;
};

export type UpdateCartItemInput = {
  quantity: number;
  expectedVersion: number;
};

export type RemoveCartItemInput = {
  expectedVersion: number;
};

const cartPath = (sellerSlug: string) => `/carts/${encodeURIComponent(sellerSlug)}`;

export const cartApiService = {
  listCarts(page = 1, limit = 20): Promise<BuyerCartPage> {
    const query = new URLSearchParams({ page: String(page), limit: String(limit) });
    return apiFetch<BuyerCartPage>(`/carts?${query.toString()}`);
  },

  getCart(sellerSlug: string): Promise<BuyerCart> {
    return apiFetch<BuyerCart>(cartPath(sellerSlug));
  },

  addCartItem(sellerSlug: string, input: AddCartItemInput): Promise<BuyerCart> {
    const { productId, productVariantId, quantity, expectedVersion } = input;
    return apiFetch<BuyerCart>(`${cartPath(sellerSlug)}/items`, {
      method: "POST",
      body: JSON.stringify({
        productId,
        ...(productVariantId === undefined ? {} : { productVariantId }),
        quantity,
        expectedVersion,
      }),
    });
  },

  updateCartItem(
    sellerSlug: string,
    itemId: string,
    input: UpdateCartItemInput,
  ): Promise<BuyerCart> {
    const { quantity, expectedVersion } = input;
    return apiFetch<BuyerCart>(`${cartPath(sellerSlug)}/items/${encodeURIComponent(itemId)}`, {
      method: "PATCH",
      body: JSON.stringify({ quantity, expectedVersion }),
    });
  },

  removeCartItem(
    sellerSlug: string,
    itemId: string,
    input: RemoveCartItemInput,
  ): Promise<BuyerCart> {
    const { expectedVersion } = input;
    return apiFetch<BuyerCart>(`${cartPath(sellerSlug)}/items/${encodeURIComponent(itemId)}`, {
      method: "DELETE",
      body: JSON.stringify({ expectedVersion }),
    });
  },
};
