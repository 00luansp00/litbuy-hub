CREATE TYPE "SellerApplicationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED');
CREATE TYPE "SellerProfileStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'CLOSED');
ALTER TYPE "SecurityEventType" ADD VALUE 'SELLER_APPLICATION_DRAFT_SAVED';
ALTER TYPE "SecurityEventType" ADD VALUE 'SELLER_APPLICATION_SUBMITTED';
ALTER TYPE "SecurityEventType" ADD VALUE 'SELLER_APPLICATION_REVIEW_STARTED';
ALTER TYPE "SecurityEventType" ADD VALUE 'SELLER_APPLICATION_APPROVED';
ALTER TYPE "SecurityEventType" ADD VALUE 'SELLER_APPLICATION_REJECTED';
ALTER TYPE "SecurityEventType" ADD VALUE 'SELLER_PROFILE_CREATED';
CREATE TABLE "SellerApplication" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "storeName" TEXT NOT NULL,
  "requestedSlug" TEXT NOT NULL,
  "description" TEXT,
  "status" "SellerApplicationStatus" NOT NULL DEFAULT 'DRAFT',
  "sellerAgreementVersion" TEXT,
  "sellerAgreementAcceptedAt" TIMESTAMP(3),
  "submittedAt" TIMESTAMP(3),
  "reviewedAt" TIMESTAMP(3),
  "reviewedByUserId" UUID,
  "rejectionCode" TEXT,
  "rejectionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SellerApplication_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "SellerProfile" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "storeName" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "status" "SellerProfileStatus" NOT NULL DEFAULT 'ACTIVE',
  "verified" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SellerProfile_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SellerApplication_userId_key" ON "SellerApplication"("userId");
CREATE INDEX "SellerApplication_status_submittedAt_idx" ON "SellerApplication"("status", "submittedAt");
CREATE INDEX "SellerApplication_requestedSlug_idx" ON "SellerApplication"("requestedSlug");
CREATE UNIQUE INDEX "SellerProfile_userId_key" ON "SellerProfile"("userId");
CREATE UNIQUE INDEX "SellerProfile_slug_key" ON "SellerProfile"("slug");
CREATE INDEX "SellerProfile_status_idx" ON "SellerProfile"("status");
CREATE INDEX "SellerProfile_slug_idx" ON "SellerProfile"("slug");
ALTER TABLE "SellerApplication" ADD CONSTRAINT "SellerApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SellerApplication" ADD CONSTRAINT "SellerApplication_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SellerProfile" ADD CONSTRAINT "SellerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
