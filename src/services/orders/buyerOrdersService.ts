import { apiFetch } from "@/lib/api/client";
import { parseBuyerOrder, parseBuyerOrderList } from "./parser";
import { isBuyerOrderCode } from "./orderCode";
import { BuyerOrderParseError } from "./parserError";
import { ORDER_STATUSES, type OrderStatus } from "./types";
const validInteger = (value: number, min: number, max: number) =>
  Number.isInteger(value) && value >= min && value <= max;
type Fetcher = (path: string, options?: RequestInit) => Promise<unknown>;
export const createBuyerOrdersService = (fetcher: Fetcher = apiFetch) => ({
  async list({ page, limit, status }: { page: number; limit: number; status?: OrderStatus }) {
    if (
      !validInteger(page, 1, 10_000) ||
      !validInteger(limit, 1, 50) ||
      (status !== undefined && !ORDER_STATUSES.includes(status))
    )
      throw new TypeError("INVALID_ORDER_QUERY");
    const query = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (status) query.set("status", status);
    return parseBuyerOrderList(await fetcher(`/orders?${query}`));
  },
  async detail(orderCode: string) {
    if (!isBuyerOrderCode(orderCode)) throw new TypeError("INVALID_ORDER_CODE");
    const order = parseBuyerOrder(await fetcher(`/orders/${encodeURIComponent(orderCode)}`));
    if (order.orderCode !== orderCode) throw new BuyerOrderParseError();
    return order;
  },
  async confirmReceipt(orderCode: string) {
    if (!isBuyerOrderCode(orderCode)) throw new TypeError("INVALID_ORDER_CODE");
    const order = parseBuyerOrder(
      await fetcher(`/orders/${encodeURIComponent(orderCode)}/fulfillment/confirm`, {
        method: "POST",
      }),
    );
    if (order.orderCode !== orderCode) throw new BuyerOrderParseError();
    return order;
  },
});
export const buyerOrdersService = createBuyerOrdersService();
