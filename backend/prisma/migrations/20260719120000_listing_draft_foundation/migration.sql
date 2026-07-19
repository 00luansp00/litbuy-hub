-- Persistent listing draft foundation: moderation-only, no public product creation.
ALTER TYPE "SecurityEventType" ADD VALUE IF NOT EXISTS 'LISTING_DRAFT_CREATED';
ALTER TYPE "SecurityEventType" ADD VALUE IF NOT EXISTS 'LISTING_DRAFT_UPDATED';
ALTER TYPE "SecurityEventType" ADD VALUE IF NOT EXISTS 'LISTING_DRAFT_SUBMITTED';
ALTER TYPE "SecurityEventType" ADD VALUE IF NOT EXISTS 'LISTING_DRAFT_REVIEW_STARTED';
ALTER TYPE "SecurityEventType" ADD VALUE IF NOT EXISTS 'LISTING_DRAFT_REJECTED';
ALTER TYPE "SecurityEventType" ADD VALUE IF NOT EXISTS 'LISTING_DRAFT_APPROVED';
CREATE TYPE "ListingDraftStatus" AS ENUM ('DRAFT','PENDING_REVIEW','UNDER_REVIEW','REJECTED','APPROVED');
CREATE TYPE "ListingDraftModel" AS ENUM ('NORMAL','DYNAMIC','SERVICE');
CREATE TYPE "ListingDraftDeliveryMode" AS ENUM ('MANUAL','AUTOMATIC');
CREATE TYPE "ListingDraftPromotionPreference" AS ENUM ('SILVER','GOLD','DIAMOND');
CREATE TYPE "ListingDraftSellerPlanPreference" AS ENUM ('STANDARD','LIT_MAX');
CREATE TYPE "ListingDraftServicePricingType" AS ENUM ('FIXED','QUOTE');
CREATE TYPE "ListingDraftVariantStatus" AS ENUM ('ACTIVE','PAUSED');
CREATE TYPE "ListingDraftAccountProvenance" AS ENUM ('ORIGINAL_OWNER','RESELLER','THIRD_PARTY','OTHER');
CREATE TYPE "ListingDraftAccountRecoveryLevel" AS ENUM ('FULL','PARTIAL','NONE','UNKNOWN');
CREATE TYPE "ListingDraftAccountRecoveryRisk" AS ENUM ('LOW','MEDIUM','HIGH');
CREATE TABLE "ListingDraft" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(), "sellerProfileId" UUID NOT NULL,
  "categoryId" UUID, "subcategoryId" UUID, "productType" "CatalogProductType", "model" "ListingDraftModel" NOT NULL DEFAULT 'NORMAL', "status" "ListingDraftStatus" NOT NULL DEFAULT 'DRAFT',
  "title" TEXT, "description" TEXT, "price" DECIMAL(12,2), "stock" INTEGER,
  "deliveryMode" "ListingDraftDeliveryMode" NOT NULL DEFAULT 'MANUAL', "requestedPromotionTier" "ListingDraftPromotionPreference" NOT NULL DEFAULT 'SILVER', "requestedSellerPlan" "ListingDraftSellerPlanPreference" NOT NULL DEFAULT 'STANDARD', "autoMessage" TEXT,
  "notifyInApp" BOOLEAN NOT NULL DEFAULT true, "notifyBrowser" BOOLEAN NOT NULL DEFAULT false, "notifyEmailFuture" BOOLEAN NOT NULL DEFAULT false, "notifyExternalFuture" BOOLEAN NOT NULL DEFAULT false,
  "wizardStep" INTEGER NOT NULL DEFAULT 1, "version" INTEGER NOT NULL DEFAULT 1,
  "submittedAt" TIMESTAMP(3), "reviewStartedAt" TIMESTAMP(3), "reviewedAt" TIMESTAMP(3), "reviewedByUserId" UUID, "rejectionCode" TEXT, "rejectionReason" TEXT, "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ListingDraft_sellerProfileId_fkey" FOREIGN KEY ("sellerProfileId") REFERENCES "SellerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ListingDraft_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "CatalogCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ListingDraft_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES "CatalogSubcategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ListingDraft_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ListingDraft_wizardStep_check" CHECK ("wizardStep" BETWEEN 1 AND 6), CONSTRAINT "ListingDraft_version_check" CHECK ("version" >= 1), CONSTRAINT "ListingDraft_price_check" CHECK ("price" IS NULL OR "price" > 0), CONSTRAINT "ListingDraft_stock_check" CHECK ("stock" IS NULL OR "stock" >= 0), CONSTRAINT "ListingDraft_approved_status_check" CHECK (("approvedAt" IS NULL) OR "status" = 'APPROVED'), CONSTRAINT "ListingDraft_rejection_status_check" CHECK (("rejectionReason" IS NULL AND "rejectionCode" IS NULL) OR "status" = 'REJECTED')
);
CREATE TABLE "ListingDraftVariant" ("id" UUID PRIMARY KEY DEFAULT gen_random_uuid(), "draftId" UUID NOT NULL, "title" TEXT NOT NULL, "description" TEXT, "price" DECIMAL(12,2) NOT NULL, "stock" INTEGER NOT NULL, "status" "ListingDraftVariantStatus" NOT NULL DEFAULT 'ACTIVE', "sortOrder" INTEGER NOT NULL DEFAULT 0, CONSTRAINT "ListingDraftVariant_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "ListingDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "ListingDraftVariant_price_check" CHECK ("price" > 0), CONSTRAINT "ListingDraftVariant_stock_check" CHECK ("stock" >= 0));
CREATE TABLE "ListingDraftAttributeValue" ("draftId" UUID NOT NULL, "key" TEXT NOT NULL, "value" TEXT NOT NULL, PRIMARY KEY ("draftId","key"), CONSTRAINT "ListingDraftAttributeValue_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "ListingDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE);
CREATE TABLE "ListingDraftServiceDetails" ("draftId" UUID PRIMARY KEY, "title" TEXT, "description" TEXT, "pricingType" "ListingDraftServicePricingType", "basePrice" DECIMAL(12,2), "estimatedDelivery" TEXT, "buyerRequirements" TEXT, "notes" TEXT, CONSTRAINT "ListingDraftServiceDetails_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "ListingDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE);
CREATE TABLE "ListingDraftAccountDetails" ("draftId" UUID PRIMARY KEY, "provenance" "ListingDraftAccountProvenance", "recoveryLevel" "ListingDraftAccountRecoveryLevel", "emailVerified" BOOLEAN, "phoneLinked" BOOLEAN, "documentLinked" BOOLEAN, "fullAccess" BOOLEAN, "recoveryRisk" "ListingDraftAccountRecoveryRisk", "warrantyNote" TEXT, CONSTRAINT "ListingDraftAccountDetails_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "ListingDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE);
CREATE INDEX "ListingDraft_sellerProfileId_status_updatedAt_idx" ON "ListingDraft"("sellerProfileId","status","updatedAt");
CREATE INDEX "ListingDraft_status_submittedAt_idx" ON "ListingDraft"("status","submittedAt");
CREATE INDEX "ListingDraft_categoryId_subcategoryId_idx" ON "ListingDraft"("categoryId","subcategoryId");
CREATE INDEX "ListingDraftVariant_draftId_sortOrder_idx" ON "ListingDraftVariant"("draftId","sortOrder");
