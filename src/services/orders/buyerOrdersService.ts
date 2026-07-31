import { apiFetch } from "@/lib/api/client";
import { parseBuyerOrder, parseBuyerOrderList } from "./parser";
import { ORDER_STATUSES, type OrderStatus } from "./types";
const orderCodePattern = /^LIT-[23456789A-HJ-NP-Z]{14}$/;
const validInteger = (value: number, min: number, max: number) =>
  Number.isInteger(value) && value >= min && value <= max;
type Fetcher = <T>(path: string) => Promise<T>;
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
    return parseBuyerOrderList(await fetcher<unknown>(`/orders?${query}`));
  },
  async detail(orderCode: string) {
    if (!orderCodePattern.test(orderCode)) throw new TypeError("INVALID_ORDER_CODE");
    return parseBuyerOrder(await fetcher<unknown>(`/orders/${encodeURIComponent(orderCode)}`));
  },
});
export const buyerOrdersService = createBuyerOrdersService();
