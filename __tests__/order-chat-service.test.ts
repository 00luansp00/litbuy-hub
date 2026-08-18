import { describe, expect, it, vi } from "vitest";
import {
  OrderChatParseError,
  createOrderChatService,
  parseOrderChatHistory,
  parseOrderChatMessage,
} from "@/services/orderChat";

const code = "LIT-23456789ABCDEF";
const message = (overrides: Record<string, unknown> = {}) => ({
  messageId: "123e4567-e89b-42d3-a456-426614174000",
  clientMessageId: "123e4567-e89b-42d3-a456-426614174001",
  author: "SELF",
  text: "Olá",
  createdAt: "2026-08-18T10:00:00.000Z",
  ...overrides,
});

describe("orderChatService", () => {
  it("monta o GET com caminho, cursor codificado e limit", async () => {
    const fetcher = vi.fn().mockResolvedValue({ items: [], nextCursor: null });
    await createOrderChatService(fetcher).readMessages(code, {
      cursor: "123e4567-e89b-42d3-a456-426614174099",
      limit: 50,
    });
    expect(fetcher).toHaveBeenCalledWith(
      `/order-chats/orders/${code}/messages?limit=50&cursor=123e4567-e89b-42d3-a456-426614174099`,
    );
  });

  it("envia clientMessageId e preserva exatamente o texto", async () => {
    const fetcher = vi.fn().mockResolvedValue(message({ text: "  teste  " }));
    const input = { clientMessageId: "123e4567-e89b-42d3-a456-426614174001", text: "  teste  " };
    await createOrderChatService(fetcher).sendMessage(code, input);
    expect(fetcher).toHaveBeenCalledWith(`/order-chats/orders/${code}/messages`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  });

  it("aceita mensagem e histórico válidos", () => {
    expect(parseOrderChatMessage(message())).toEqual(message());
    expect(parseOrderChatHistory({ items: [message()], nextCursor: null }).items).toHaveLength(1);
  });

  it.each([
    ["author desconhecido", message({ author: "ADMIN" })],
    ["messageId inválido", message({ messageId: "não-uuid" })],
    ["clientMessageId inválido", message({ clientMessageId: "não-uuid" })],
    ["createdAt inválido", message({ createdAt: "ontem" })],
  ])("rejeita %s", (_label, payload) => {
    expect(() => parseOrderChatMessage(payload)).toThrow(OrderChatParseError);
  });

  it.each([
    ["items ausente", { nextCursor: null }],
    ["items inválido", { items: {}, nextCursor: null }],
    ["item inválido", { items: [message({ author: "OTHER" })], nextCursor: null }],
    ["nextCursor inválido", { items: [], nextCursor: "cursor" }],
  ])("falha fechado para histórico com %s", (_label, payload) => {
    expect(() => parseOrderChatHistory(payload)).toThrow(OrderChatParseError);
  });
});
