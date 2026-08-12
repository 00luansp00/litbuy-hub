import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { ApiError, apiFetch } from "@/lib/api/client";

export const balanceKeys = [
  "pendingMinor",
  "heldMinor",
  "availableMinor",
  "reservedMinor",
  "deficitMinor",
] as const;
export type BalanceKey = (typeof balanceKeys)[number];
export type SellerFinanceBalances = Record<BalanceKey, string>;
export interface SellerFinanceSummary {
  currency: "BRL";
  balances: SellerFinanceBalances;
}
export interface SellerFinanceActivityItem {
  id: string;
  type: string;
  referenceType: string | null;
  referenceId: string | null;
  createdAt: string;
  currency: "BRL";
  movements: SellerFinanceBalances;
}
export interface SellerFinanceActivityPage {
  items: SellerFinanceActivityItem[];
  nextCursor: string | null;
}
export class SellerFinanceParseError extends Error {
  constructor() {
    super("Resposta financeira inválida.");
    this.name = "SellerFinanceParseError";
  }
}

const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new SellerFinanceParseError();
  return value as Record<string, unknown>;
};
export const parseMoneyMinor = (value: unknown): string => {
  if (typeof value !== "string" || !/^\d+$/.test(value)) throw new SellerFinanceParseError();
  BigInt(value);
  return value;
};
export const parseSignedMoneyMinor = (value: unknown): string => {
  if (typeof value !== "string" || !/^-?\d+$/.test(value)) throw new SellerFinanceParseError();
  BigInt(value);
  return value;
};
const parseBuckets = (value: unknown, signed: boolean): SellerFinanceBalances => {
  const input = record(value);
  const output = {} as SellerFinanceBalances;
  for (const key of balanceKeys)
    output[key] = signed ? parseSignedMoneyMinor(input[key]) : parseMoneyMinor(input[key]);
  return output;
};
export function parseSellerFinanceSummary(value: unknown): SellerFinanceSummary {
  const input = record(value);
  if (input.currency !== "BRL") throw new SellerFinanceParseError();
  return { currency: "BRL", balances: parseBuckets(input.balances, false) };
}
export function parseSellerFinanceActivity(value: unknown): SellerFinanceActivityPage {
  const input = record(value);
  if (
    !Array.isArray(input.items) ||
    !(input.nextCursor === null || typeof input.nextCursor === "string")
  )
    throw new SellerFinanceParseError();
  return {
    nextCursor: input.nextCursor,
    items: input.items.map((raw) => {
      const item = record(raw);
      if (
        typeof item.id !== "string" ||
        typeof item.type !== "string" ||
        !(item.referenceType === null || typeof item.referenceType === "string") ||
        !(item.referenceId === null || typeof item.referenceId === "string") ||
        typeof item.createdAt !== "string" ||
        Number.isNaN(Date.parse(item.createdAt)) ||
        item.currency !== "BRL"
      )
        throw new SellerFinanceParseError();
      return {
        id: item.id,
        type: item.type,
        referenceType: item.referenceType,
        referenceId: item.referenceId,
        createdAt: item.createdAt,
        currency: "BRL",
        movements: parseBuckets(item.movements, true),
      };
    }),
  };
}
export const sellerFinanceService = {
  summary: async () =>
    parseSellerFinanceSummary(await apiFetch<unknown>("/seller/finance/summary")),
  activity: async (limit = 20, cursor?: string) =>
    parseSellerFinanceActivity(
      await apiFetch<unknown>(
        `/seller/finance/activity?limit=${limit}${cursor === undefined ? "" : `&cursor=${encodeURIComponent(cursor)}`}`,
      ),
    ),
};
const retry = (count: number, error: Error) =>
  !(error instanceof SellerFinanceParseError) &&
  !(error instanceof ApiError && [400, 401, 403, 404].includes(error.status)) &&
  count < 2;
export const sellerFinanceKeys = {
  summary: ["seller-finance", "summary"] as const,
  activity: ["seller-finance", "activity"] as const,
};
export const useSellerFinanceSummary = () =>
  useQuery({
    queryKey: sellerFinanceKeys.summary,
    queryFn: sellerFinanceService.summary,
    retry,
    staleTime: 30_000,
  });
export const useSellerFinanceActivity = (limit = 20) =>
  useInfiniteQuery({
    queryKey: [...sellerFinanceKeys.activity, limit],
    queryFn: ({ pageParam }) => sellerFinanceService.activity(limit, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    retry,
  });

export function formatBrlMinor(value: string, signed = false): string {
  const parsed = parseSignedMoneyMinor(value);
  const amount = BigInt(parsed);
  const negative = amount < 0n;
  const digits = (negative ? -amount : amount).toString().padStart(3, "0");
  const whole = digits.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const sign = signed ? (negative ? "-" : "+") : negative ? "-" : "";
  return `${sign}R$ ${whole},${digits.slice(-2)}`;
}
