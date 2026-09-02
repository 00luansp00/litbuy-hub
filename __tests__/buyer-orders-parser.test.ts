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
  parseBuyerOrderCode,
} from "@/services/orders";
const valid = () => ({
  orderCode: "LIT-23456789ABCDEF",
  seller: { slug: "seller", storeName: "Seller" },
  currency: "BRL",
  subtotalAmountMinor: "900719925474099300",
  discountAmountMinor: "0",
  platformFeeAmountMinor: "100",
  totalAmountMinor: "900719925474099400",
  buyerVipPlan: null as null | "NONE" | "BASIC" | "PREMIUM",
  buyerVipFeeAmountMinor: "0",
  status: "PENDING_PAYMENT",
  paymentStatus: "NOT_CREATED",
  fulfillmentStatus: "NOT_AVAILABLE",
  disputeStatus: "NONE",
  disputeCases: [],
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
  it.each([
    [null, "0"],
    ["NONE", "0"],
    ["BASIC", "299"],
    ["PREMIUM", "499"],
  ] as const)("accepts Buyer VIP snapshot %s with fee %s", (buyerVipPlan, fee) => {
    expect(
      parseBuyerOrder({ ...valid(), buyerVipPlan, buyerVipFeeAmountMinor: fee }),
    ).toMatchObject({ buyerVipPlan, buyerVipFeeAmountMinor: fee });
  });
  it("rejects missing Buyer VIP fields", () => {
    const missingPlan = valid() as Record<string, unknown>;
    delete missingPlan.buyerVipPlan;
    expect(() => parseBuyerOrder(missingPlan)).toThrowError(BuyerOrderParseError);
    const missingFee = valid() as Record<string, unknown>;
    delete missingFee.buyerVipFeeAmountMinor;
    expect(() => parseBuyerOrder(missingFee)).toThrowError(BuyerOrderParseError);
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
  it.each([
    "BAD-23456789ABCDEF",
    "LIT-23456789ABCDE",
    "LIT-23456789ABCDEFG",
    "LIT-03456789ABCDEF",
    "LIT-13456789ABCDEF",
    "LIT-23456789ABCDEI",
    "LIT-23456789ABCDEO",
    "LIT-23456789abcDEF",
    " LIT-23456789ABCDEF",
    "LIT-23456789ABCDEF ",
    "",
  ])("rejects invalid public order code %j", (orderCode) => {
    expect(() => parseBuyerOrderCode(orderCode)).toThrow("MALFORMED_RESPONSE");
    expect(() => parseBuyerOrder({ ...valid(), orderCode })).toThrow("MALFORMED_RESPONSE");
    expect(() =>
      parseBuyerOrderList({ page: 1, limit: 20, items: [{ ...valid(), orderCode }] }),
    ).toThrow("MALFORMED_RESPONSE");
  });
  it("rejects empty historical seller fields", () => {
    malformed((o) => {
      o.seller.slug = "";
    });
    malformed((o) => {
      o.seller.storeName = "";
    });
  });
  it("validates pagination boundaries and exact ISO dates", () => {
    expect(parseBuyerOrderList({ page: 1, limit: 50, items: [] })).toEqual({
      page: 1,
      limit: 50,
      items: [],
    });
    expect(() => parseBuyerOrderList({ page: 0, limit: 20, items: [] })).toThrow(
      "MALFORMED_RESPONSE",
    );
    expect(() => parseBuyerOrderList({ page: 1, limit: 51, items: [] })).toThrow(
      "MALFORMED_RESPONSE",
    );
    malformed((o) => {
      o.expiresAt = "2026-08-01";
    });
  });
  it("accepts 100 money digits and rejects 101", () => {
    const hundred = "9".repeat(100);
    expect(parseBuyerOrder({ ...valid(), totalAmountMinor: hundred }).totalAmountMinor).toBe(
      hundred,
    );
    malformed((o) => {
      o.totalAmountMinor = "9".repeat(101);
    });
  });
});
