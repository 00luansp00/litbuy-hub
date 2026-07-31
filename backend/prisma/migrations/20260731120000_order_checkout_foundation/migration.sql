-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING_PAYMENT', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'EXPIRED', 'REFUNDED', 'CHARGEBACK');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('NOT_CREATED', 'PENDING', 'PROCESSING', 'PAID', 'FAILED', 'EXPIRED', 'REFUND_PENDING', 'PARTIALLY_REFUNDED', 'REFUNDED', 'CHARGEBACK');

-- CreateEnum
CREATE TYPE "FulfillmentStatus" AS ENUM ('NOT_AVAILABLE', 'AWAITING_SELLER', 'DELIVERED', 'AWAITING_BUYER_CONFIRMATION', 'CONFIRMED');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('NONE', 'OPEN', 'UNDER_REVIEW', 'RESOLVED_BUYER', 'RESOLVED_SELLER', 'CLOSED');

-- CreateEnum
CREATE TYPE "InventoryReservationStatus" AS ENUM ('ACTIVE', 'RELEASED', 'EXPIRED', 'CONSUMED');

-- CreateEnum
CREATE TYPE "CommerceIdempotencyOperation" AS ENUM ('CHECKOUT_CREATE', 'ORDER_CANCEL');

-- CreateEnum
CREATE TYPE "OrderEventType" AS ENUM ('ORDER_CREATED', 'INVENTORY_RESERVED', 'ORDER_CANCELLED', 'INVENTORY_RELEASED', 'ORDER_EXPIRED');

-- CreateEnum
CREATE TYPE "OutboxEventStatus" AS ENUM ('PENDING', 'PUBLISHED', 'FAILED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SecurityEventType" ADD VALUE 'CHECKOUT_ORDER_CREATED';
ALTER TYPE "SecurityEventType" ADD VALUE 'ORDER_CANCELLED';
ALTER TYPE "SecurityEventType" ADD VALUE 'ORDER_EXPIRED';

-- AlterTable
ALTER TABLE "Cart" ADD COLUMN     "checkedOutAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Order" (
    "id" UUID NOT NULL,
    "publicCode" TEXT NOT NULL,
    "sourceCartId" UUID NOT NULL,
    "sourceCartVersion" INTEGER NOT NULL,
    "buyerUserId" UUID NOT NULL,
    "sellerProfileId" UUID NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "subtotalAmountMinor" BIGINT NOT NULL,
    "discountAmountMinor" BIGINT NOT NULL DEFAULT 0,
    "platformFeeAmountMinor" BIGINT NOT NULL DEFAULT 0,
    "totalAmountMinor" BIGINT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'NOT_CREATED',
    "fulfillmentStatus" "FulfillmentStatus" NOT NULL DEFAULT 'NOT_AVAILABLE',
    "disputeStatus" "DisputeStatus" NOT NULL DEFAULT 'NONE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "pricingPolicyVersion" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "expiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "sourceProductId" UUID NOT NULL,
    "sourceProductVersion" INTEGER NOT NULL,
    "sourceProductVariantId" UUID,
    "sellerProfileId" UUID NOT NULL,
    "sellerStoreName" TEXT NOT NULL,
    "sellerSlug" TEXT NOT NULL,
    "productSlug" TEXT NOT NULL,
    "productTitle" TEXT NOT NULL,
    "variantTitle" TEXT,
    "productType" "CatalogProductType" NOT NULL,
    "productModel" "ListingDraftModel" NOT NULL,
    "deliveryMode" "ListingDraftDeliveryMode" NOT NULL,
    "unitAmountMinor" BIGINT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "lineTotalAmountMinor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "serviceEstimatedDelivery" TEXT,
    "serviceBuyerRequirements" TEXT,
    "pricingPolicyVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryReservation" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "orderItemId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "productVariantId" UUID,
    "quantity" INTEGER NOT NULL,
    "status" "InventoryReservationStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "releasedAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),
    "releaseReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryReservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommerceIdempotencyRecord" (
    "id" UUID NOT NULL,
    "actorUserId" UUID NOT NULL,
    "operation" "CommerceIdempotencyOperation" NOT NULL,
    "keyHash" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "responseStatus" INTEGER,
    "responseBody" JSONB,
    "resourceType" TEXT,
    "resourceId" UUID,
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommerceIdempotencyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderEvent" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "type" "OrderEventType" NOT NULL,
    "actorUserId" UUID,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboxEvent" (
    "id" UUID NOT NULL,
    "orderEventId" UUID NOT NULL,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" UUID NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "OutboxEventStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),
    "lastErrorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Order_publicCode_key" ON "Order"("publicCode");

-- CreateIndex
CREATE UNIQUE INDEX "Order_sourceCartId_key" ON "Order"("sourceCartId");

-- CreateIndex
CREATE INDEX "Order_buyerUserId_createdAt_id_idx" ON "Order"("buyerUserId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Order_sellerProfileId_createdAt_id_idx" ON "Order"("sellerProfileId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Order_status_expiresAt_idx" ON "Order"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryReservation_orderItemId_key" ON "InventoryReservation"("orderItemId");

-- CreateIndex
CREATE INDEX "InventoryReservation_status_expiresAt_idx" ON "InventoryReservation"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "InventoryReservation_productId_status_expiresAt_idx" ON "InventoryReservation"("productId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "InventoryReservation_productVariantId_status_expiresAt_idx" ON "InventoryReservation"("productVariantId", "status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "CommerceIdempotencyRecord_actorUserId_operation_keyHash_key" ON "CommerceIdempotencyRecord"("actorUserId", "operation", "keyHash");

-- CreateIndex
CREATE INDEX "OrderEvent_orderId_createdAt_idx" ON "OrderEvent"("orderId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OutboxEvent_orderEventId_key" ON "OutboxEvent"("orderEventId");

-- CreateIndex
CREATE INDEX "OutboxEvent_status_availableAt_idx" ON "OutboxEvent"("status", "availableAt");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_sourceCartId_fkey" FOREIGN KEY ("sourceCartId") REFERENCES "Cart"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_buyerUserId_fkey" FOREIGN KEY ("buyerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_sellerProfileId_fkey" FOREIGN KEY ("sellerProfileId") REFERENCES "SellerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_sourceProductId_fkey" FOREIGN KEY ("sourceProductId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_sourceProductVariantId_sourceProductId_fkey" FOREIGN KEY ("sourceProductVariantId", "sourceProductId") REFERENCES "ProductVariant"("id", "productId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryReservation" ADD CONSTRAINT "InventoryReservation_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryReservation" ADD CONSTRAINT "InventoryReservation_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryReservation" ADD CONSTRAINT "InventoryReservation_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryReservation" ADD CONSTRAINT "InventoryReservation_productVariantId_productId_fkey" FOREIGN KEY ("productVariantId", "productId") REFERENCES "ProductVariant"("id", "productId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommerceIdempotencyRecord" ADD CONSTRAINT "CommerceIdempotencyRecord_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderEvent" ADD CONSTRAINT "OrderEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboxEvent" ADD CONSTRAINT "OutboxEvent_orderEventId_fkey" FOREIGN KEY ("orderEventId") REFERENCES "OrderEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "Order" ADD CONSTRAINT "Order_version_check" CHECK ("version" >= 1),
 ADD CONSTRAINT "Order_money_nonnegative_check" CHECK ("subtotalAmountMinor" >= 0 AND "discountAmountMinor" >= 0 AND "platformFeeAmountMinor" >= 0 AND "totalAmountMinor" >= 0),
 ADD CONSTRAINT "Order_discount_check" CHECK ("discountAmountMinor" <= "subtotalAmountMinor"),
 ADD CONSTRAINT "Order_total_check" CHECK ("totalAmountMinor" = "subtotalAmountMinor" - "discountAmountMinor" + "platformFeeAmountMinor"),
 ADD CONSTRAINT "Order_currency_check" CHECK ("currency" = 'BRL');
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_quantity_check" CHECK ("quantity" BETWEEN 1 AND 999),
 ADD CONSTRAINT "OrderItem_money_check" CHECK ("unitAmountMinor" >= 0 AND "lineTotalAmountMinor" = "unitAmountMinor" * "quantity"),
 ADD CONSTRAINT "OrderItem_currency_check" CHECK ("currency" = 'BRL');
ALTER TABLE "InventoryReservation" ADD CONSTRAINT "InventoryReservation_quantity_check" CHECK ("quantity" > 0);
