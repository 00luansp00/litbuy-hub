import {
  DISPUTE_STATUSES,
  FULFILLMENT_STATUSES,
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  type BuyerOrder,
  type BuyerOrderItem,
  type BuyerOrderListResponse,
} from "./types";
import { parseBuyerOrderCode } from "./orderCode";
import { BuyerOrderParseError } from "./parserError";

export { BuyerOrderParseError } from "./parserError";
const fail = (): never => {
  throw new BuyerOrderParseError();
};
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const record = (value: unknown): Record<string, unknown> => {
  if (!isRecord(value)) throw new BuyerOrderParseError();
  return value;
};
const text = (value: unknown): string =>
  typeof value === "string" && value.length > 0 ? value : fail();
const nullableText = (value: unknown): string | null => (value === null ? null : text(value));
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER): number =>
  typeof value === "number" && Number.isInteger(value) && value >= min && value <= max
    ? value
    : fail();
const date = (value: unknown): string => {
  const result = text(value);
  return !Number.isNaN(Date.parse(result)) && new Date(result).toISOString() === result
    ? result
    : fail();
};
const nullableDate = (value: unknown): string | null => (value === null ? null : date(value));
const enumValue = <T extends string>(value: unknown, allowed: readonly T[]): T =>
  typeof value === "string" && allowed.includes(value as T) ? (value as T) : fail();
export const parseMoneyMinor = (value: unknown): string =>
  typeof value === "string" && /^\d{1,100}$/.test(value) ? value : fail();
const currency = (value: unknown): "BRL" => (value === "BRL" ? "BRL" : fail());
const seller = (value: unknown) => {
  const v = record(value);
  return { slug: text(v.slug), storeName: text(v.storeName) };
};
const item = (value: unknown): BuyerOrderItem => {
  const v = record(value);
  return {
    productSlug: text(v.productSlug),
    productTitle: text(v.productTitle),
    variantTitle: nullableText(v.variantTitle),
    productType: text(v.productType),
    productModel: text(v.productModel),
    deliveryMode: text(v.deliveryMode),
    quantity: integer(v.quantity, 1),
    unitAmountMinor: parseMoneyMinor(v.unitAmountMinor),
    lineTotalAmountMinor: parseMoneyMinor(v.lineTotalAmountMinor),
    currency: currency(v.currency),
    serviceEstimatedDelivery: nullableText(v.serviceEstimatedDelivery),
    serviceBuyerRequirements: nullableText(v.serviceBuyerRequirements),
  };
};
export function parseBuyerOrder(value: unknown): BuyerOrder {
  const v = record(value);
  const items = v.items;
  if (!Array.isArray(items) || items.length === 0) throw new BuyerOrderParseError();
  return {
    orderCode: parseBuyerOrderCode(v.orderCode),
    seller: seller(v.seller),
    currency: currency(v.currency),
    subtotalAmountMinor: parseMoneyMinor(v.subtotalAmountMinor),
    discountAmountMinor: parseMoneyMinor(v.discountAmountMinor),
    platformFeeAmountMinor: parseMoneyMinor(v.platformFeeAmountMinor),
    totalAmountMinor: parseMoneyMinor(v.totalAmountMinor),
    status: enumValue(v.status, ORDER_STATUSES),
    paymentStatus: enumValue(v.paymentStatus, PAYMENT_STATUSES),
    fulfillmentStatus: enumValue(v.fulfillmentStatus, FULFILLMENT_STATUSES),
    disputeStatus: enumValue(v.disputeStatus, DISPUTE_STATUSES),
    version: integer(v.version, 1),
    expiresAt: date(v.expiresAt),
    cancelledAt: nullableDate(v.cancelledAt),
    expiredAt: nullableDate(v.expiredAt),
    createdAt: date(v.createdAt),
    updatedAt: date(v.updatedAt),
    items: items.map(item),
  };
}
export function parseBuyerOrderList(value: unknown): BuyerOrderListResponse {
  const v = record(value);
  const items = v.items;
  if (!Array.isArray(items)) throw new BuyerOrderParseError();
  return {
    page: integer(v.page, 1),
    limit: integer(v.limit, 1, 50),
    items: items.map(parseBuyerOrder),
  };
}
