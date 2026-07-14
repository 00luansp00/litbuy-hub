ALTER TYPE "VerificationPurpose" ADD VALUE IF NOT EXISTS 'PHONE_VERIFICATION';
ALTER TYPE "VerificationPurpose" ADD VALUE IF NOT EXISTS 'EMAIL_CHANGE_CURRENT';
ALTER TYPE "VerificationPurpose" ADD VALUE IF NOT EXISTS 'EMAIL_CHANGE_NEW';
ALTER TYPE "SecurityEventType" ADD VALUE IF NOT EXISTS 'PHONE_VERIFICATION_REQUESTED';
ALTER TYPE "SecurityEventType" ADD VALUE IF NOT EXISTS 'PHONE_VERIFIED';
ALTER TYPE "SecurityEventType" ADD VALUE IF NOT EXISTS 'PHONE_CHANGED';
ALTER TYPE "SecurityEventType" ADD VALUE IF NOT EXISTS 'EMAIL_CHANGE_REQUESTED';
ALTER TYPE "SecurityEventType" ADD VALUE IF NOT EXISTS 'EMAIL_CHANGE_CURRENT_CONFIRMED';
ALTER TYPE "SecurityEventType" ADD VALUE IF NOT EXISTS 'EMAIL_CHANGE_NEW_CONFIRMED';
ALTER TYPE "SecurityEventType" ADD VALUE IF NOT EXISTS 'EMAIL_CHANGED';
ALTER TYPE "SecurityEventType" ADD VALUE IF NOT EXISTS 'SENSITIVE_ACTION_HOLD_STARTED';
ALTER TABLE "User" ADD COLUMN "sensitiveActionHoldUntil" TIMESTAMP(3), ADD COLUMN "lastSensitiveChangeAt" TIMESTAMP(3);
ALTER TABLE "VerificationChallenge" ADD COLUMN "targetHash" TEXT, ADD COLUMN "contextId" UUID;
CREATE UNIQUE INDEX "User_phoneE164_key" ON "User"("phoneE164");
CREATE INDEX "VerificationChallenge_targetHash_idx" ON "VerificationChallenge"("targetHash");
CREATE INDEX "VerificationChallenge_contextId_idx" ON "VerificationChallenge"("contextId");
CREATE TABLE "EmailChangeRequest" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "newEmailHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "currentEmailConfirmedAt" TIMESTAMP(3),
  "newEmailConfirmedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmailChangeRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "EmailChangeRequest_userId_idx" ON "EmailChangeRequest"("userId");
CREATE INDEX "EmailChangeRequest_newEmailHash_idx" ON "EmailChangeRequest"("newEmailHash");
CREATE INDEX "EmailChangeRequest_completedAt_cancelledAt_expiresAt_idx" ON "EmailChangeRequest"("completedAt", "cancelledAt", "expiresAt");
ALTER TABLE "EmailChangeRequest" ADD CONSTRAINT "EmailChangeRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
