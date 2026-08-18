CREATE TABLE "OrderChatConversation" (
  "id" UUID NOT NULL,
  "orderId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastMessageAt" TIMESTAMP(3),
  CONSTRAINT "OrderChatConversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrderChatMessage" (
  "id" UUID NOT NULL,
  "conversationId" UUID NOT NULL,
  "senderUserId" UUID NOT NULL,
  "clientMessageId" UUID NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderChatMessage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrderChatConversation_orderId_key" ON "OrderChatConversation"("orderId");
CREATE UNIQUE INDEX "OrderChatMessage_conversationId_senderUserId_clientMessageId_key"
  ON "OrderChatMessage"("conversationId", "senderUserId", "clientMessageId");
CREATE INDEX "OrderChatMessage_conversationId_createdAt_id_idx"
  ON "OrderChatMessage"("conversationId", "createdAt", "id");
CREATE INDEX "OrderChatMessage_senderUserId_idx" ON "OrderChatMessage"("senderUserId");

ALTER TABLE "OrderChatConversation" ADD CONSTRAINT "OrderChatConversation_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderChatMessage" ADD CONSTRAINT "OrderChatMessage_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "OrderChatConversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderChatMessage" ADD CONSTRAINT "OrderChatMessage_senderUserId_fkey"
  FOREIGN KEY ("senderUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
