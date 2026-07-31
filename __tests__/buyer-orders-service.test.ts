import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/api/client";
import { buyerOrdersService, createBuyerOrdersService } from "@/services/orders";
import { makeOrder } from "./buyer-orders-ui-fixtures";
vi.mock("@/lib/api/client", async (original) => {
  const actual = await original<typeof import("@/lib/api/client")>();
  return { ...actual, apiFetch: vi.fn() };
});
const mocked = vi.mocked(apiFetch);
const response = { page: 1, limit: 20, items: [] };
describe("buyerOrdersService", () => {
  beforeEach(() => mocked.mockReset());
  it("uses authenticated read-only list endpoints and always parses", async () => {
    mocked.mockResolvedValue(response);
    await buyerOrdersService.list({ page: 1, limit: 20 });
    expect(mocked).toHaveBeenCalledWith("/orders?page=1&limit=20");
    expect(mocked.mock.calls[0]).toHaveLength(1);
    mocked.mockResolvedValue({ nope: true });
    await expect(buyerOrdersService.list({ page: 1, limit: 20 })).rejects.toMatchObject({
      code: "MALFORMED_RESPONSE",
    });
  });
  it("adds a validated status filter", async () => {
    mocked.mockResolvedValue(response);
    await buyerOrdersService.list({ page: 1, limit: 20, status: "PENDING_PAYMENT" });
    expect(mocked).toHaveBeenCalledWith("/orders?page=1&limit=20&status=PENDING_PAYMENT");
  });
  it("preserves ApiError", async () => {
    const error = { name: "ApiError", status: 404, code: "ORDER_NOT_FOUND" };
    const service = createBuyerOrdersService(async () => {
      throw error;
    });
    let caught: unknown;
    try {
      await service.detail("LIT-23456789ABCDEF");
    } catch (value) {
      caught = value;
    }
    if (caught !== error) throw new Error("ApiError was not preserved");
  });
  it("rejects invalid input before the network", async () => {
    await expect(buyerOrdersService.list({ page: 0, limit: 20 })).rejects.toThrow(
      "INVALID_ORDER_QUERY",
    );
    await expect(buyerOrdersService.detail("invalid")).rejects.toThrow("INVALID_ORDER_CODE");
    expect(mocked).not.toHaveBeenCalled();
  });
  it("reads a matching detail from the encoded GET endpoint", async () => {
    const fetcher = vi.fn(async () => makeOrder());
    const service = createBuyerOrdersService(fetcher);
    await expect(service.detail("LIT-23456789ABCDEF")).resolves.toEqual(makeOrder());
    expect(fetcher).toHaveBeenCalledWith("/orders/LIT-23456789ABCDEF");
    expect(fetcher.mock.calls[0]).toHaveLength(1);
  });
  it("rejects a different order code as MALFORMED_RESPONSE", async () => {
    const service = createBuyerOrdersService(async () =>
      makeOrder({ orderCode: "LIT-23456789ABCDEG" }),
    );
    await expect(service.detail("LIT-23456789ABCDEF")).rejects.toMatchObject({
      code: "MALFORMED_RESPONSE",
    });
  });
  it("contains no mutation, payment, mock-data or auth bypass request", async () => {
    mocked.mockResolvedValue(response);
    await buyerOrdersService.list({ page: 1, limit: 20 });
    const serializedCalls = JSON.stringify(mocked.mock.calls);
    expect(serializedCalls).not.toMatch(/POST|PATCH|DELETE|payment|checkout|auth/);
  });
});
