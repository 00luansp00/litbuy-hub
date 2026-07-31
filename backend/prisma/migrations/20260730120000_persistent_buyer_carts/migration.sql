CREATE TYPE "CartStatus" AS ENUM ('ACTIVE', 'CHECKED_OUT', 'ABANDONED');

ALTER TYPE "SecurityEventType" ADD VALUE 'CART_CREATED';
ALTER TYPE "SecurityEventType" ADD VALUE 'CART_ITEM_ADDED';
ALTER TYPE "SecurityEventType" ADD VALUE 'CART_ITEM_UPDATED';
ALTER TYPE "SecurityEventType" ADD VALUE 'CART_ITEM_REMOVED';

CREATE TABLE "Cart" (
  "id" UUID NOT NULL,
  "buyerUserId" UUID NOT NULL,
  "sellerProfileId" UUID NOT NULL,
  "status" "CartStatus" NOT NULL DEFAULT 'ACTIVE',
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Cart_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Cart_version_check" CHECK ("version" >= 1)
);
CREATE TABLE "CartItem" (
  "id" UUID NOT NULL,
  "cartId" UUID NOT NULL,
  "productId" UUID NOT NULL,
  "productVariantId" UUID,
  "quantity" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CartItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CartItem_quantity_check" CHECK ("quantity" BETWEEN 1 AND 999)
);
CREATE INDEX "Cart_buyerUserId_updatedAt_id_idx" ON "Cart"("buyerUserId", "updatedAt", "id");
CREATE INDEX "Cart_sellerProfileId_status_idx" ON "Cart"("sellerProfileId", "status");
CREATE UNIQUE INDEX "Cart_active_buyer_seller_key" ON "Cart"("buyerUserId", "sellerProfileId") WHERE "status" = 'ACTIVE';
CREATE INDEX "CartItem_cartId_idx" ON "CartItem"("cartId");
CREATE INDEX "CartItem_productId_idx" ON "CartItem"("productId");
CREATE INDEX "CartItem_productVariantId_productId_idx" ON "CartItem"("productVariantId", "productId");
CREATE UNIQUE INDEX "CartItem_product_without_variant_key" ON "CartItem"("cartId", "productId") WHERE "productVariantId" IS NULL;
CREATE UNIQUE INDEX "CartItem_product_with_variant_key" ON "CartItem"("cartId", "productId", "productVariantId") WHERE "productVariantId" IS NOT NULL;
CREATE UNIQUE INDEX "ProductVariant_id_productId_key" ON "ProductVariant"("id", "productId");
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_buyerUserId_fkey" FOREIGN KEY ("buyerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_sellerProfileId_fkey" FOREIGN KEY ("sellerProfileId") REFERENCES "SellerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_productVariantId_productId_fkey" FOREIGN KEY ("productVariantId", "productId") REFERENCES "ProductVariant"("id", "productId") ON DELETE RESTRICT ON UPDATE CASCADE;
