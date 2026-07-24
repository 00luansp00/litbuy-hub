CREATE TYPE "ProductImageStatus" AS ENUM ('PENDING_UPLOAD', 'READY', 'DELETED');
ALTER TYPE "SecurityEventType" ADD VALUE 'PRODUCT_IMAGE_UPLOAD_INTENT_CREATED';
ALTER TYPE "SecurityEventType" ADD VALUE 'PRODUCT_IMAGE_UPLOAD_COMPLETED';
ALTER TYPE "SecurityEventType" ADD VALUE 'PRODUCT_IMAGE_UPLOAD_REJECTED';
ALTER TYPE "SecurityEventType" ADD VALUE 'PRODUCT_IMAGE_COVER_CHANGED';
ALTER TYPE "SecurityEventType" ADD VALUE 'PRODUCT_IMAGES_REORDERED';
ALTER TYPE "SecurityEventType" ADD VALUE 'PRODUCT_IMAGE_DELETED';
CREATE TABLE "ProductImage" (
  "id" UUID NOT NULL, "productId" UUID NOT NULL, "objectKey" TEXT NOT NULL,
  "status" "ProductImageStatus" NOT NULL DEFAULT 'PENDING_UPLOAD',
  "contentType" TEXT NOT NULL, "sizeBytes" INTEGER NOT NULL, "altText" TEXT,
  "sortOrder" INTEGER NOT NULL, "isCover" BOOLEAN NOT NULL DEFAULT false,
  "uploadedAt" TIMESTAMP(3), "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProductImage_size_positive" CHECK ("sizeBytes" > 0),
  CONSTRAINT "ProductImage_sort_order_nonnegative" CHECK ("sortOrder" >= 0),
  CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ProductImage_objectKey_key" ON "ProductImage"("objectKey");
CREATE INDEX "ProductImage_productId_status_sortOrder_idx" ON "ProductImage"("productId", "status", "sortOrder");
CREATE UNIQUE INDEX "ProductImage_one_ready_cover_per_product" ON "ProductImage"("productId") WHERE "isCover" = true AND "status" = 'READY';
