CREATE TYPE "OrderDeliveryType" AS ENUM ('MANUAL_REFERENCE', 'AUTOMATED_REFERENCE');

ALTER TYPE "OrderEventType" ADD VALUE 'FULFILLMENT_AVAILABLE';
ALTER TYPE "OrderEventType" ADD VALUE 'FULFILLMENT_DELIVERED';
ALTER TYPE "OrderEventType" ADD VALUE 'FULFILLMENT_AWAITING_BUYER_CONFIRMATION';
ALTER TYPE "OrderEventType" ADD VALUE 'FULFILLMENT_CONFIRMED';
ALTER TYPE "OrderEventType" ADD VALUE 'ORDER_COMPLETED';

CREATE TABLE "OrderDelivery" (
  "id" UUID NOT NULL,
  "orderId" UUID NOT NULL,
  "sellerProfileId" UUID NOT NULL,
  "deliveryType" "OrderDeliveryType" NOT NULL,
  "evidenceHash" TEXT NOT NULL,
  "secureReference" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrderDelivery_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OrderDelivery_evidenceHash_sha256" CHECK ("evidenceHash" ~ '^[0-9a-f]{64}$')
);

CREATE UNIQUE INDEX "Order_id_sellerProfileId_key" ON "Order"("id", "sellerProfileId");
CREATE UNIQUE INDEX "OrderDelivery_orderId_key" ON "OrderDelivery"("orderId");
CREATE UNIQUE INDEX "OrderDelivery_orderId_sellerProfileId_key" ON "OrderDelivery"("orderId", "sellerProfileId");
CREATE INDEX "OrderDelivery_sellerProfileId_createdAt_idx" ON "OrderDelivery"("sellerProfileId", "createdAt");
ALTER TABLE "OrderDelivery" ADD CONSTRAINT "OrderDelivery_orderId_sellerProfileId_fkey" FOREIGN KEY ("orderId", "sellerProfileId") REFERENCES "Order"("id", "sellerProfileId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderDelivery" ADD CONSTRAINT "OrderDelivery_sellerProfileId_fkey" FOREIGN KEY ("sellerProfileId") REFERENCES "SellerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
