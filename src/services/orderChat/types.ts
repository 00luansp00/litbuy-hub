export type OrderChatAuthor = "SELF" | "COUNTERPARTY";
export type OrderChatMessage = {
  messageId: string;
  clientMessageId: string;
  author: OrderChatAuthor;
  text: string;
  createdAt: string;
};
export type OrderChatHistory = { items: OrderChatMessage[]; nextCursor: string | null };
export type SendOrderChatMessage = { clientMessageId: string; text: string };
