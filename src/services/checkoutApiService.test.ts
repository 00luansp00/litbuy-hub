import { afterEach, describe, expect, it, vi } from "vitest";
import { checkoutIntentKey } from "./checkoutApiHooks";
import { checkoutApiService } from "./checkoutApiService";

afterEach(() => vi.unstubAllGlobals());

describe("checkoutApiService", () => {
  it("posts only authoritative intent fields with its idempotency key", async () => {
    const response = { orderCode: "LIT-23456789ABCDEFG" };
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(response), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await checkoutApiService.createCheckoutSession({
      sellerSlug: "loja-a",
      expectedCartVersion: 7,
      expectedPreviewFingerprint: "fingerprint-a",
      buyerVipPlan: "BASIC",
      idempotencyKey: "checkout:00000000-0000-4000-8000-000000000000",
    });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://localhost:3001/api/v1/checkout-sessions");
    expect(init.method).toBe("POST");
    expect((init.headers as Headers).get("Idempotency-Key")).toBe(
      "checkout:00000000-0000-4000-8000-000000000000",
    );
    expect(JSON.parse(String(init.body))).toEqual({
      sellerSlug: "loja-a",
      expectedCartVersion: 7,
      expectedPreviewFingerprint: "fingerprint-a",
      buyerVipPlan: "BASIC",
    });
    expect(result.orderCode).toBe(response.orderCode);
  });
});

describe("checkoutIntentKey", () => {
  it("reuses a key for the same intent and changes it with version or fingerprint", () => {
    vi.stubGlobal("crypto", {
      randomUUID: vi
        .fn()
        .mockReturnValueOnce("uuid-a")
        .mockReturnValueOnce("uuid-b")
        .mockReturnValueOnce("uuid-c"),
    });
    const first = checkoutIntentKey("seller", 1, "fp-a");
    expect(checkoutIntentKey("seller", 1, "fp-a")).toBe(first);
    expect(checkoutIntentKey("seller", 2, "fp-a")).not.toBe(first);
    expect(checkoutIntentKey("seller", 1, "fp-b")).not.toBe(first);
  });
});
