import { describe, expect, it, vi } from "vitest";
import { createSellerSalesService } from "@/services/orders/sellerSales";

const sale = {
  orderCode: "LIT-23456789ABCDEF",
  currency: "BRL",
  saleAmountMinor: "12345",
  status: "ACTIVE",
  paymentStatus: "PAID",
  fulfillmentStatus: "AWAITING_SELLER",
  disputeStatus: "NONE",
  version: 3,
  createdAt: "2026-08-11T00:00:00.000Z",
  updatedAt: "2026-08-11T00:00:00.000Z",
  items: [
    {
      productSlug: "produto",
      productTitle: "Produto real",
      variantTitle: null,
      productType: "DIGITAL",
      productModel: "NORMAL",
      deliveryMode: "MANUAL",
      quantity: 1,
      unitAmountMinor: "12345",
      lineTotalAmountMinor: "12345",
      currency: "BRL",
      serviceEstimatedDelivery: null,
      serviceBuyerRequirements: null,
    },
  ],
};
describe("seller sales service", () => {
  it("lists and parses persisted sales", async () => {
    const fetcher = vi.fn().mockResolvedValue({ page: 1, limit: 20, items: [sale] });
    const result = await createSellerSalesService(fetcher).list(1, 20);
    expect(fetcher).toHaveBeenCalledWith("/seller/orders?page=1&limit=20");
    expect(result.items[0].saleAmountMinor).toBe("12345");
  });
  it("posts an empty public payload to the authoritative delivery endpoint", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue({ ...sale, fulfillmentStatus: "AWAITING_BUYER_CONFIRMATION", version: 5 });
    const result = await createSellerSalesService(fetcher).markDelivered(sale.orderCode);
    expect(fetcher).toHaveBeenCalledWith(`/orders/${sale.orderCode}/fulfillment/delivered`, {
      method: "POST",
      body: "{}",
    });
    expect(result.fulfillmentStatus).toBe("AWAITING_BUYER_CONFIRMATION");
  });
  it("rejects internal delivery fields in malformed responses", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ...sale, orderCode: "internal-id" });
    await expect(createSellerSalesService(fetcher).detail(sale.orderCode)).rejects.toThrow();
  });
});
