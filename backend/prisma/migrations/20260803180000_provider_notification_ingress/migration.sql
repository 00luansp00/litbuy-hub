CREATE TYPE "ProviderPaymentStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'EXPIRED');
CREATE TYPE "ProviderNotificationKind" AS ENUM ('BILLING_TOKEN');
CREATE TYPE "ProviderNotificationInboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'PROCESSED', 'RETRY_SCHEDULED', 'FAILED', 'RECONCILIATION_REQUIRED');

ALTER TABLE "ProviderWebhookEvent"
  ADD COLUMN "externalPaymentId" TEXT NOT NULL,
  ADD COLUMN "normalizedPaymentStatus" "ProviderPaymentStatus" NOT NULL,
  ADD COLUMN "occurredAt" TIMESTAMP(3);

CREATE TABLE "ProviderNotificationInbox" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "providerCode" TEXT NOT NULL,
  "notificationKind" "ProviderNotificationKind" NOT NULL,
  "contentType" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "protectedKeyId" TEXT NOT NULL,
  "protectedVersion" INTEGER NOT NULL,
  "protectedIv" BYTEA NOT NULL,
  "protectedCiphertext" BYTEA NOT NULL,
  "protectedAuthTag" BYTEA NOT NULL,
  "status" "ProviderNotificationInboxStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processingStartedAt" TIMESTAMP(3),
  "processedAt" TIMESTAMP(3),
  "lastErrorCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProviderNotificationInbox_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProviderNotificationInbox_attempts_check" CHECK ("attempts" >= 0),
  CONSTRAINT "ProviderNotificationInbox_protected_version_check" CHECK ("protectedVersion" > 0),
  CONSTRAINT "ProviderNotificationInbox_protected_iv_check" CHECK (octet_length("protectedIv") = 12),
  CONSTRAINT "ProviderNotificationInbox_protected_auth_tag_check" CHECK (octet_length("protectedAuthTag") = 16),
  CONSTRAINT "ProviderNotificationInbox_payload_hash_check" CHECK ("payloadHash" ~ '^[0-9a-f]{64}$')
);
CREATE INDEX "ProviderNotificationInbox_status_availableAt_receivedAt_idx" ON "ProviderNotificationInbox"("status", "availableAt", "receivedAt");
CREATE INDEX "ProviderNotificationInbox_providerCode_payloadHash_idx" ON "ProviderNotificationInbox"("providerCode", "payloadHash");
