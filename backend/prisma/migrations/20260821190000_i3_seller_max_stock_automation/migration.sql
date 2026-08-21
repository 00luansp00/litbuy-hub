ALTER TYPE "SecurityEventType" ADD VALUE 'PRODUCT_AUTO_PAUSED_OUT_OF_STOCK';
ALTER TYPE "SecurityEventType" ADD VALUE 'PRODUCT_INVENTORY_RESTOCKED';
ALTER TYPE "SecurityEventType" ADD VALUE 'PRODUCT_AUTO_RESUMED_AFTER_RESTOCK';

ALTER TYPE "CommerceIdempotencyOperation" ADD VALUE 'SELLER_MAX_RESTOCK';

CREATE TYPE "ProductPauseReason" AS ENUM ('SELLER_MAX_OUT_OF_STOCK');

ALTER TABLE "Product" ADD COLUMN "pauseReason" "ProductPauseReason";

ALTER TABLE "Product" ADD CONSTRAINT "Product_pauseReason_requires_paused_status_check"
CHECK ("pauseReason" IS NULL OR "status" = 'PAUSED');
