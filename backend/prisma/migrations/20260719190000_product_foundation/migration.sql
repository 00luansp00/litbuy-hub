-- Product materialization foundation: products are internal and start UNPUBLISHED.
ALTER TYPE "SecurityEventType" ADD VALUE IF NOT EXISTS 'PRODUCT_MATERIALIZED';

CREATE TYPE "ProductStatus" AS ENUM ('UNPUBLISHED', 'ACTIVE', 'PAUSED', 'REMOVED');
CREATE TYPE "ProductVariantStatus" AS ENUM ('ACTIVE', 'PAUSED');

CREATE TABLE "Product" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "sourceListingDraftId" UUID NOT NULL,
  "sellerProfileId" UUID NOT NULL,
  "categoryId" UUID NOT NULL,
  "subcategoryId" UUID,
  "productType" "CatalogProductType" NOT NULL,
  "model" "ListingDraftModel" NOT NULL,
  "status" "ProductStatus" NOT NULL DEFAULT 'UNPUBLISHED',
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "price" DECIMAL(12,2),
  "stock" INTEGER,
  "deliveryMode" "ListingDraftDeliveryMode" NOT NULL DEFAULT 'MANUAL',
  "autoMessage" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductVariant" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "productId" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "price" DECIMAL(12,2),
  "stock" INTEGER,
  "status" "ProductVariantStatus" NOT NULL DEFAULT 'ACTIVE',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductAttributeValue" (
  "productId" UUID NOT NULL,
  "key" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  CONSTRAINT "ProductAttributeValue_pkey" PRIMARY KEY ("productId","key")
);

CREATE TABLE "ProductServiceDetails" (
  "productId" UUID NOT NULL,
  "pricingType" "ListingDraftServicePricingType" NOT NULL,
  "basePrice" DECIMAL(12,2),
  "estimatedDelivery" TEXT,
  "buyerRequirements" TEXT,
  "notes" TEXT,
  CONSTRAINT "ProductServiceDetails_pkey" PRIMARY KEY ("productId")
);

CREATE TABLE "ProductAccountDetails" (
  "productId" UUID NOT NULL,
  "provenance" "ListingDraftAccountProvenance",
  "recoveryLevel" "ListingDraftAccountRecoveryLevel",
  "emailVerified" BOOLEAN,
  "phoneLinked" BOOLEAN,
  "documentLinked" BOOLEAN,
  "fullAccess" BOOLEAN,
  "recoveryRisk" "ListingDraftAccountRecoveryRisk",
  "warrantyNote" TEXT,
  CONSTRAINT "ProductAccountDetails_pkey" PRIMARY KEY ("productId")
);

CREATE UNIQUE INDEX "Product_sourceListingDraftId_key" ON "Product"("sourceListingDraftId");
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");
CREATE INDEX "Product_sellerProfileId_status_updatedAt_idx" ON "Product"("sellerProfileId", "status", "updatedAt");
CREATE INDEX "Product_status_updatedAt_idx" ON "Product"("status", "updatedAt");
CREATE INDEX "Product_categoryId_subcategoryId_idx" ON "Product"("categoryId", "subcategoryId");
CREATE INDEX "ProductVariant_productId_sortOrder_idx" ON "ProductVariant"("productId", "sortOrder");
CREATE INDEX "ProductVariant_productId_status_idx" ON "ProductVariant"("productId", "status");

ALTER TABLE "Product" ADD CONSTRAINT "Product_sourceListingDraftId_fkey" FOREIGN KEY ("sourceListingDraftId") REFERENCES "ListingDraft"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_sellerProfileId_fkey" FOREIGN KEY ("sellerProfileId") REFERENCES "SellerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "CatalogCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES "CatalogSubcategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductAttributeValue" ADD CONSTRAINT "ProductAttributeValue_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductServiceDetails" ADD CONSTRAINT "ProductServiceDetails_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductAccountDetails" ADD CONSTRAINT "ProductAccountDetails_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
