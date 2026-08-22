import { apiFetch } from "@/lib/api/client";
import type {
  DisputeStatus,
  FulfillmentStatus,
  OrderStatus,
  PaymentStatus,
} from "@/services/orders";
import type { BuyerVipPlan } from "./cartApiService";

export type CreateCheckoutSessionInput = {
  sellerSlug: string;
  expectedCartVersion: number;
  expectedPreviewFingerprint: string;
  buyerVipPlan: BuyerVipPlan;
  idempotencyKey: string;
};

export type CheckoutOrderItem = {
  productSlug: string;
  productTitle: string;
  variantTitle: string | null;
  quantity: number;
  unitAmountMinor: string;
  lineTotalAmountMinor: string;
  currency: "BRL";
};

export type CheckoutOrder = {
  orderCode: string;
  seller: { slug: string; storeName: string };
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  disputeStatus: DisputeStatus;
  currency: "BRL";
  subtotalAmountMinor: string;
  discountAmountMinor: string;
  platformFeeAmountMinor: string;
  totalAmountMinor: string;
  buyerVipPlan: BuyerVipPlan;
  version: number;
  expiresAt: string;
  createdAt: string;
  items: CheckoutOrderItem[];
};

export const checkoutApiService = {
  createCheckoutSession(input: CreateCheckoutSessionInput): Promise<CheckoutOrder> {
    const {
      idempotencyKey,
      sellerSlug,
      expectedCartVersion,
      expectedPreviewFingerprint,
      buyerVipPlan,
    } = input;
    return apiFetch<CheckoutOrder>("/checkout-sessions", {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({
        sellerSlug,
        expectedCartVersion,
        expectedPreviewFingerprint,
        buyerVipPlan,
      }),
    });
  },
};
