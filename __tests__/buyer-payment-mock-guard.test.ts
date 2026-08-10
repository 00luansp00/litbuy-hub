import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
describe("buyer Alpha payment boundary", () => {
  it("does not import or retain the legacy frontend payment mock", () => {
    expect(existsSync("src/services/paymentService.ts")).toBe(false);
    expect(readFileSync("src/routes/pagamento.$id.tsx", "utf8")).not.toContain("paymentService");
  });
  it("uses the authenticated provider-neutral API without mutation retries", () => {
    const source = readFileSync("src/services/payments.ts", "utf8");
    expect(source).toContain("/payment-attempts");
    expect(source).toContain('"Idempotency-Key"');
    expect(source.match(/retry: false/g)?.length).toBeGreaterThanOrEqual(3);
  });
});
