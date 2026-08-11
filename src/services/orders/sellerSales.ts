import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, ApiError } from "@/lib/api/client";
import { isBuyerOrderCode } from "./orderCode";
import { parseMoneyMinor } from "./parser";
import { BuyerOrderParseError } from "./parserError";
import {
  DISPUTE_STATUSES,
  FULFILLMENT_STATUSES,
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  type BuyerOrderItem,
  type DisputeStatus,
  type FulfillmentStatus,
  type OrderStatus,
  type PaymentStatus,
} from "./types";

export type SellerSale = {
  orderCode: string;
  currency: "BRL";
  saleAmountMinor: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  disputeStatus: DisputeStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
  items: BuyerOrderItem[];
};
export type SellerSaleList = { page: number; limit: number; items: SellerSale[] };
const fail = (): never => {
  throw new BuyerOrderParseError();
};
const obj = (v: unknown): Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : fail();
const text = (v: unknown) => (typeof v === "string" && v.length ? v : fail());
const nullable = (v: unknown) => (v === null ? null : text(v));
const integer = (v: unknown, min: number, max = Number.MAX_SAFE_INTEGER) =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max ? v : fail();
const enumOf = <T extends string>(v: unknown, values: readonly T[]): T =>
  typeof v === "string" && values.includes(v as T) ? (v as T) : fail();
const date = (v: unknown) => {
  const value = text(v);
  return !Number.isNaN(Date.parse(value)) && new Date(value).toISOString() === value
    ? value
    : fail();
};
const item = (raw: unknown): BuyerOrderItem => {
  const v = obj(raw);
  return {
    productSlug: text(v.productSlug),
    productTitle: text(v.productTitle),
    variantTitle: nullable(v.variantTitle),
    productType: text(v.productType),
    productModel: text(v.productModel),
    deliveryMode: text(v.deliveryMode),
    quantity: integer(v.quantity, 1),
    unitAmountMinor: parseMoneyMinor(v.unitAmountMinor),
    lineTotalAmountMinor: parseMoneyMinor(v.lineTotalAmountMinor),
    currency: v.currency === "BRL" ? "BRL" : fail(),
    serviceEstimatedDelivery: nullable(v.serviceEstimatedDelivery),
    serviceBuyerRequirements: nullable(v.serviceBuyerRequirements),
  };
};
export function parseSellerSale(raw: unknown): SellerSale {
  const v = obj(raw);
  if (!isBuyerOrderCode(v.orderCode) || !Array.isArray(v.items) || !v.items.length) return fail();
  return {
    orderCode: v.orderCode,
    currency: v.currency === "BRL" ? "BRL" : fail(),
    saleAmountMinor: parseMoneyMinor(v.saleAmountMinor),
    status: enumOf(v.status, ORDER_STATUSES),
    paymentStatus: enumOf(v.paymentStatus, PAYMENT_STATUSES),
    fulfillmentStatus: enumOf(v.fulfillmentStatus, FULFILLMENT_STATUSES),
    disputeStatus: enumOf(v.disputeStatus, DISPUTE_STATUSES),
    version: integer(v.version, 1),
    createdAt: date(v.createdAt),
    updatedAt: date(v.updatedAt),
    items: v.items.map(item),
  };
}
export function parseSellerSaleList(raw: unknown): SellerSaleList {
  const v = obj(raw);
  if (!Array.isArray(v.items)) return fail();
  return {
    page: integer(v.page, 1),
    limit: integer(v.limit, 1, 50),
    items: v.items.map(parseSellerSale),
  };
}
type Fetcher = (path: string, options?: RequestInit) => Promise<unknown>;
export const createSellerSalesService = (fetcher: Fetcher = apiFetch) => ({
  async list(page: number, limit: number) {
    if (
      !Number.isInteger(page) ||
      page < 1 ||
      page > 10_000 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 50
    )
      throw new TypeError("INVALID_ORDER_QUERY");
    return parseSellerSaleList(await fetcher(`/seller/orders?page=${page}&limit=${limit}`));
  },
  async detail(code: string) {
    if (!isBuyerOrderCode(code)) throw new TypeError("INVALID_ORDER_CODE");
    const sale = parseSellerSale(await fetcher(`/seller/orders/${encodeURIComponent(code)}`));
    if (sale.orderCode !== code) fail();
    return sale;
  },
  async markDelivered(code: string) {
    if (!isBuyerOrderCode(code)) throw new TypeError("INVALID_ORDER_CODE");
    const sale = parseSellerSale(
      await fetcher(`/orders/${encodeURIComponent(code)}/fulfillment/delivered`, {
        method: "POST",
        body: "{}",
      }),
    );
    if (sale.orderCode !== code) fail();
    return sale;
  },
});
export const sellerSalesService = createSellerSalesService();
const retry = (count: number, error: Error) =>
  !(error instanceof BuyerOrderParseError) &&
  !(error instanceof TypeError) &&
  !(error instanceof ApiError && [401, 403, 404].includes(error.status)) &&
  count < 2;
export const sellerSaleKeys = {
  all: ["seller-sales"] as const,
  list: (page: number, limit: number) => ["seller-sales", page, limit] as const,
  detail: (code: string) => ["seller-sale", code] as const,
};
export const useSellerSales = (page: number, limit: number) =>
  useQuery({
    queryKey: sellerSaleKeys.list(page, limit),
    queryFn: () => sellerSalesService.list(page, limit),
    retry,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
export const useSellerSale = (code: string) =>
  useQuery({
    queryKey: sellerSaleKeys.detail(code),
    queryFn: () => sellerSalesService.detail(code),
    retry,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
export const useMarkSellerSaleDelivered = (code: string) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => sellerSalesService.markDelivered(code),
    retry: false,
    onSuccess: async (sale) => {
      client.setQueryData(sellerSaleKeys.detail(code), sale);
      await Promise.all([
        client.invalidateQueries({ queryKey: sellerSaleKeys.detail(code) }),
        client.invalidateQueries({ queryKey: sellerSaleKeys.all }),
      ]);
    },
    onError: async () => {
      await client.invalidateQueries({ queryKey: sellerSaleKeys.detail(code) });
    },
  });
};
