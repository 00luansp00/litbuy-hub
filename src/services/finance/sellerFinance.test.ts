import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/api/client";
import {
  formatBrlMinor,
  parseSellerFinanceActivity,
  parseSellerFinanceSummary,
  sellerFinanceService,
} from "./sellerFinance";

vi.mock("@/lib/api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/client")>();
  return { ...actual, apiFetch: vi.fn() };
});
const mockedApiFetch = vi.mocked(apiFetch);

const balances = {
  pendingMinor: "0",
  heldMinor: "0",
  availableMinor: "900719925474099300",
  reservedMinor: "0",
  deficitMinor: "0",
};
describe("seller finance contract", () => {
  beforeEach(() => mockedApiFetch.mockReset());
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
            createdAt: "2026-08-12T00:00:00.000Z",
            currency: "BRL",
            movements: { ...balances, heldMinor },
          },
        ],
        nextCursor: null,
      }),
    ).toThrow(),
  );
  it("rejects an invalid activity date independently", () =>
    expect(() =>
      parseSellerFinanceActivity({
        items: [
          {
            id: "tx",
            type: "SALE_RECOGNIZED",
            referenceType: "ORDER",
            referenceId: "order",
            createdAt: "invalid",
            currency: "BRL",
            movements: balances,
          },
        ],
        nextCursor: null,
      }),
    ).toThrow("Resposta financeira inválida"));
});

describe("seller finance HTTP client", () => {
  beforeEach(() => mockedApiFetch.mockReset());
  it("reads and strictly parses summary without authority identifiers", async () => {
    mockedApiFetch.mockResolvedValue({ currency: "BRL", balances });
    await expect(sellerFinanceService.summary()).resolves.toEqual({ currency: "BRL", balances });
    expect(mockedApiFetch).toHaveBeenCalledWith("/seller/finance/summary");
    expect(mockedApiFetch.mock.calls[0]).toHaveLength(1);
    expect(JSON.stringify(mockedApiFetch.mock.calls)).not.toMatch(
      /sellerId|sellerProfileId|userId|accountId|ledgerId/,
    );
  });
  it("reads the first activity page with only its effective limit", async () => {
    mockedApiFetch.mockResolvedValue({ items: [], nextCursor: null });
    await sellerFinanceService.activity(20);
    expect(mockedApiFetch).toHaveBeenCalledWith("/seller/finance/activity?limit=20");
  });
  it("preserves an opaque cursor, URL-encodes it, and uses another limit", async () => {
    mockedApiFetch.mockResolvedValue({ items: [], nextCursor: null });
    await sellerFinanceService.activity(37, "abc+/=opaque");
    expect(mockedApiFetch).toHaveBeenCalledWith(
      "/seller/finance/activity?limit=37&cursor=abc%2B%2F%3Dopaque",
    );
  });
});
