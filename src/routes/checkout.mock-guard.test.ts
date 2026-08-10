import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("real checkout dependency guard", () => {
  it("does not import legacy cart, checkout, payment, or product mocks", () => {
    const source = readFileSync("src/routes/checkout.tsx", "utf8");
    for (const legacy of [
      "@/providers/CartProvider",
      "@/services/cartService",
      "@/services/checkoutService",
      "@/services/paymentService",
      "@/data/products",
    ])
      expect(source).not.toContain(legacy);
  });
});
