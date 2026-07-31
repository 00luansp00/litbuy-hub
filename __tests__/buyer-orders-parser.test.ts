import { describe, expect, it } from "vitest";
import {
  DISPUTE_STATUSES,
  FULFILLMENT_STATUSES,
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  BuyerOrderParseError,
  formatBrlMinor,
  parseBuyerOrder,
  parseBuyerOrderList,
} from "@/services/orders";
const valid = () => ({
  orderCode: "LIT-23456789ABCDEF",
  seller: { slug: "seller", storeName: "Seller" },
  currency: "BRL",
  subtotalAmountMinor: "900719925474099300",
  discountAmountMinor: "0",
  platformFeeAmountMinor: "100",
  totalAmountMinor: "900719925474099400",
  status: "PENDING_PAYMENT",
  paymentStatus: "NOT_CREATED",
  fulfillmentStatus: "NOT_AVAILABLE",
  disputeStatus: "NONE",
  version: 1,
  expiresAt: "2026-08-01T00:00:00.000Z",
  cancelledAt: null,
  expiredAt: null,
  createdAt: "2026-07-31T00:00:00.000Z",
  updatedAt: "2026-07-31T00:00:00.000Z",
  items: [
    {
      productSlug: "item",
      productTitle: "Item histórico",
      variantTitle: null,
      productType: "DIGITAL",
      productModel: "UNIT",
      deliveryMode: "MANUAL",
      quantity: 1,
      unitAmountMinor: "900719925474099400",
      lineTotalAmountMinor: "900719925474099400",
      currency: "BRL",
      serviceEstimatedDelivery: null,
      serviceBuyerRequirements: null,
    },
  ],
});
const malformed = (change: (order: ReturnType<typeof valid>) => void) => {
  const order = valid();
  change(order);
  expect(() => parseBuyerOrder(order)).toThrowError(BuyerOrderParseError);
};
describe("buyer order parser", () => {
  it("parses detail and list responses", () => {
    expect(parseBuyerOrder(valid()).orderCode).toBe("LIT-23456789ABCDEF");
    expect(parseBuyerOrderList({ page: 1, limit: 20, items: [valid()] }).items).toHaveLength(1);
  });
  it("accepts every defined enum", () => {
    for (const status of ORDER_STATUSES)
      expect(parseBuyerOrder({ ...valid(), status }).status).toBe(status);
    for (const paymentStatus of PAYMENT_STATUSES)
      expect(parseBuyerOrder({ ...valid(), paymentStatus }).paymentStatus).toBe(paymentStatus);
    for (const fulfillmentStatus of FULFILLMENT_STATUSES)
      expect(parseBuyerOrder({ ...valid(), fulfillmentStatus }).fulfillmentStatus).toBe(
        fulfillmentStatus,
      );
    for (const disputeStatus of DISPUTE_STATUSES)
      expect(parseBuyerOrder({ ...valid(), disputeStatus }).disputeStatus).toBe(disputeStatus);
  });
  it("formats money above Number.MAX_SAFE_INTEGER without precision loss", () =>
    expect(formatBrlMinor("900719925474099312345")).toBe("R$ 9.007.199.254.740.993.123,45"));
  it("rejects malformed money, currency, dates and enums", () => {
    malformed((o) => {
      o.totalAmountMinor = "1.20";
    });
    malformed((o) => {
      o.currency = "USD" as "BRL";
    });
    malformed((o) => {
      o.createdAt = "yesterday";
    });
    malformed((o) => {
      o.status = "NEW" as "PENDING_PAYMENT";
    });
  });
  it("rejects zero version and quantity", () => {
    malformed((o) => {
      o.version = 0;
    });
    malformed((o) => {
      o.items[0].quantity = 0;
    });
  });
  it("rejects missing seller/items and non-objects with stable code", () => {
    const order = valid();
    delete (order as Partial<typeof order>).seller;
    expect(() => parseBuyerOrder(order)).toThrow("MALFORMED_RESPONSE");
    malformed((o) => {
      o.items = [];
    });
    expect(() => parseBuyerOrder(null)).toThrow("MALFORMED_RESPONSE");
    expect(() => parseBuyerOrderList([])).toThrow("MALFORMED_RESPONSE");
  });
});
