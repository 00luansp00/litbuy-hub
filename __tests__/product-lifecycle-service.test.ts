import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ProductLifecyclePayloadError,
  parseProductLifecycleState,
  productLifecycleService,
} from "@/services/productLifecycleService";
import { apiFetch } from "@/lib/api/client";

vi.mock("@/lib/api/client", () => ({ apiFetch: vi.fn() }));
const valid = {
  id: "8bc72aa9-1de9-4e97-a578-c151c9e68f45",
  slug: "produto-real",
  status: "ACTIVE",
  version: 2,
  updatedAt: "2026-07-28T12:00:00.000Z",
  changed: true,
};
describe("productLifecycleService", () => {
  beforeEach(() => vi.clearAllMocks());
  it("parses a valid lifecycle response", () =>
    expect(parseProductLifecycleState(valid, true)).toEqual(valid));
  it.each([
    { ...valid, id: "bad" },
    { ...valid, status: "SOLD_OUT" },
    { ...valid, version: 0 },
    { ...valid, updatedAt: "today" },
    { ...valid, changed: "yes" },
  ])("rejects malformed responses", (payload) =>
    expect(() => parseProductLifecycleState(payload, true)).toThrow(ProductLifecyclePayloadError),
  );
  it("calls the real PATCH contract without a mock fallback", async () => {
    vi.mocked(apiFetch).mockResolvedValue(valid);
    await expect(productLifecycleService.transition(valid.id, "ACTIVATE", 1)).resolves.toEqual(
      valid,
    );
    expect(apiFetch).toHaveBeenCalledWith(`/seller/products/${valid.id}/lifecycle`, {
      method: "PATCH",
      body: JSON.stringify({ action: "ACTIVATE", expectedVersion: 1 }),
    });
  });
});
