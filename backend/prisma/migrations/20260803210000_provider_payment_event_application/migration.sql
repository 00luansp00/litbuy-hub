ALTER TABLE "Payment" ADD COLUMN "paidAt" TIMESTAMP(3);

ALTER TABLE "ProviderWebhookEvent"
  ADD COLUMN "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "processingStartedAt" TIMESTAMP(3);

CREATE INDEX "ProviderWebhookEvent_status_availableAt_receivedAt_idx"
  ON "ProviderWebhookEvent"("status", "availableAt", "receivedAt");
