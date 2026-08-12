import { describe, expect, it } from "vitest";
import {
  formatBrlMinor,
  parseSellerFinanceActivity,
  parseSellerFinanceSummary,
} from "./sellerFinance";

const balances = {
  pendingMinor: "0",
  heldMinor: "0",
  availableMinor: "900719925474099300",
  reservedMinor: "0",
  deficitMinor: "0",
};
describe("seller finance contract", () => {
  it("preserves all summary minor-unit strings beyond number precision", () => {
    expect(parseSellerFinanceSummary({ currency: "BRL", balances }).balances.availableMinor).toBe(
      "900719925474099300",
    );
    expect(formatBrlMinor("900719925474099300")).toBe("R$ 9.007.199.254.740.993,00");
  });
  it.each([
    { currency: "USD", balances },
    { currency: "BRL", balances: { ...balances, heldMinor: 1 } },
    { currency: "BRL", balances: { pendingMinor: "0" } },
  ])("rejects malformed summary %#", (value) =>
    expect(() => parseSellerFinanceSummary(value)).toThrow("Resposta financeira inválida"),
  );
  it("accepts signed movements, nullable references and a final cursor", () => {
    const page = parseSellerFinanceActivity({
      items: [
        {
          id: "tx",
          type: "SELLER_FUNDS_RELEASED",
          referenceType: null,
          referenceId: null,
          createdAt: "2026-08-12T00:00:00.000Z",
          currency: "BRL",
          movements: { ...balances, heldMinor: "-9000", availableMinor: "9000" },
        },
      ],
      nextCursor: null,
    });
    expect(page.items[0]?.movements).toMatchObject({ heldMinor: "-9000", availableMinor: "9000" });
    expect(formatBrlMinor("-9000", true)).toBe("-R$ 90,00");
    expect(formatBrlMinor("9000", true)).toBe("+R$ 90,00");
    expect(page.nextCursor).toBeNull();
  });
  it.each(["+1", "1.2", "--1", 1])("rejects malformed signed minor %s", (heldMinor) =>
    expect(() =>
      parseSellerFinanceActivity({
        items: [
          {
            id: "tx",
            type: "X",
            referenceType: "ORDER",
            referenceId: "r",
            createdAt: "invalid",
            currency: "BRL",
            movements: { ...balances, heldMinor },
          },
        ],
        nextCursor: null,
      }),
    ).toThrow(),
  );
});
