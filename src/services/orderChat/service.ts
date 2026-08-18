import { apiFetch } from "@/lib/api/client";
import { isBuyerOrderCode } from "@/services/orders/orderCode";
import { isUuid, parseOrderChatHistory, parseOrderChatMessage } from "./parser";
import type { SendOrderChatMessage } from "./types";
type Fetcher = (path: string, options?: RequestInit) => Promise<unknown>;
export const createOrderChatService = (fetcher: Fetcher = apiFetch) => ({
  async readMessages(orderCode: string, options: { cursor?: string; limit?: number } = {}) {
    if (!isBuyerOrderCode(orderCode)) throw new TypeError("INVALID_ORDER_CODE");
    const limit = options.limit ?? 30;
    if (!Number.isInteger(limit) || limit < 1 || limit > 50)
      throw new TypeError("INVALID_ORDER_CHAT_LIMIT");
    if (options.cursor !== undefined && !isUuid(options.cursor))
      throw new TypeError("INVALID_ORDER_CHAT_CURSOR");
    const query = new URLSearchParams({ limit: String(limit) });
    if (options.cursor) query.set("cursor", options.cursor);
    return parseOrderChatHistory(
      await fetcher(
        `/order-chats/orders/${encodeURIComponent(orderCode)}/messages?${query.toString()}`,
      ),
    );
  },
  async sendMessage(orderCode: string, input: SendOrderChatMessage) {
    if (!isBuyerOrderCode(orderCode)) throw new TypeError("INVALID_ORDER_CODE");
    if (!isUuid(input.clientMessageId)) throw new TypeError("INVALID_CLIENT_MESSAGE_ID");
    if (typeof input.text !== "string" || !input.text.trim() || input.text.length > 4000)
      throw new TypeError("INVALID_ORDER_CHAT_TEXT");
    return parseOrderChatMessage(
      await fetcher(`/order-chats/orders/${encodeURIComponent(orderCode)}/messages`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    );
  },
});
export const orderChatService = createOrderChatService();
