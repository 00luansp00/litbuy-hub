import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const critical = [
  "src/routes/vendedor.vendas.index.tsx",
  "src/routes/vendedor.vendas.$id.tsx",
  "src/services/orders/sellerSales.ts",
];
describe("seller sales critical path", () => {
  it.each(critical)("does not depend on the legacy seller sale mock: %s", (file) => {
    const source = readFileSync(file, "utf8");
    expect(source).not.toContain("sellerSaleService");
    expect(source).not.toContain("simulateMarkAsDelivered");
  });
});
