export const ORDER_STATUSES = [
  "PENDING_PAYMENT",
  "ACTIVE",
  "COMPLETED",
  "CANCELLED",
  "EXPIRED",
  "REFUNDED",
  "CHARGEBACK",
] as const;
export const PAYMENT_STATUSES = [
  "NOT_CREATED",
  "PENDING",
  "PROCESSING",
  "PAID",
  "FAILED",
  "EXPIRED",
  "REFUND_PENDING",
  "PARTIALLY_REFUNDED",
  "REFUNDED",
  "CHARGEBACK",
] as const;
export const FULFILLMENT_STATUSES = [
  "NOT_AVAILABLE",
  "AWAITING_SELLER",
  "DELIVERED",
  "AWAITING_BUYER_CONFIRMATION",
  "CONFIRMED",
] as const;
export const DISPUTE_STATUSES = [
  "NONE",
  "OPEN",
  "UNDER_REVIEW",
  "RESOLVED_BUYER",
  "RESOLVED_SELLER",
  "CLOSED",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export type FulfillmentStatus = (typeof FULFILLMENT_STATUSES)[number];
export type DisputeStatus = (typeof DISPUTE_STATUSES)[number];
export type BuyerOrderItem = {
  productSlug: string;
  productTitle: string;
  variantTitle: string | null;
  productType: string;
  productModel: string;
  deliveryMode: string;
  quantity: number;
  unitAmountMinor: string;
  lineTotalAmountMinor: string;
  currency: "BRL";
  serviceEstimatedDelivery: string | null;
  serviceBuyerRequirements: string | null;
};
export type BuyerOrder = {
  orderCode: string;
  seller: { slug: string; storeName: string };
  currency: "BRL";
  subtotalAmountMinor: string;
  discountAmountMinor: string;
  platformFeeAmountMinor: string;
  totalAmountMinor: string;
  buyerVipPlan: "NONE" | "BASIC" | "PREMIUM" | null;
  buyerVipFeeAmountMinor: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  disputeStatus: DisputeStatus;
  version: number;
  expiresAt: string;
  cancelledAt: string | null;
  expiredAt: string | null;
  createdAt: string;
  updatedAt: string;
  items: BuyerOrderItem[];
};
export type BuyerOrderListResponse = { page: number; limit: number; items: BuyerOrder[] };
