import type { OrderChatHistory, OrderChatMessage } from "./types";
export class OrderChatParseError extends Error {
  readonly code = "MALFORMED_RESPONSE";
  constructor() {
    super("MALFORMED_RESPONSE");
    this.name = "OrderChatParseError";
  }
}
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const isUuid = (value: unknown): value is string =>
  typeof value === "string" && UUID_PATTERN.test(value);
const fail = (): never => {
  throw new OrderChatParseError();
};
const record = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : fail();
const isoDate = (value: unknown): string => {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) return fail();
  return new Date(value).toISOString() === value ? value : fail();
};
export function parseOrderChatMessage(value: unknown): OrderChatMessage {
  const data = record(value);
  if (!isUuid(data.messageId) || !isUuid(data.clientMessageId)) return fail();
  if (data.author !== "SELF" && data.author !== "COUNTERPARTY") return fail();
  if (typeof data.text !== "string") return fail();
  return {
    messageId: data.messageId,
    clientMessageId: data.clientMessageId,
    author: data.author,
    text: data.text,
    createdAt: isoDate(data.createdAt),
  };
}
export function parseOrderChatHistory(value: unknown): OrderChatHistory {
  const data = record(value);
  if (!Array.isArray(data.items)) return fail();
  if (data.nextCursor !== null && !isUuid(data.nextCursor)) return fail();
  return { items: data.items.map(parseOrderChatMessage), nextCursor: data.nextCursor };
}
