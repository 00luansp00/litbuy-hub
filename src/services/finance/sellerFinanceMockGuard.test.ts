import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("seller finance mock regression guard", () => {
  it("keeps critical finance surfaces independent from the legacy mock", () => {
    for (const file of [
      "src/routes/vendedor.financeiro.tsx",
      "src/routes/vendedor.index.tsx",
      "src/components/seller-dashboard/SellerFinanceSummaryCard.tsx",
      "src/services/finance/sellerFinance.ts",
    ]) {
      expect(readFileSync(file, "utf8")).not.toContain("getSellerFinancialSummary");
    }
  });
});
