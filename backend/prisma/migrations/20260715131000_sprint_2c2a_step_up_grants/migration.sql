CREATE TABLE "StepUpGrant" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "sessionId" UUID NOT NULL,
  "deviceId" UUID NOT NULL,
  "scope" "StepUpScope" NOT NULL,
  "assurance" "StepUpAssurance" NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StepUpGrant_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StepUpGrant_tokenHash_key" ON "StepUpGrant"("tokenHash");
CREATE INDEX "StepUpGrant_userId_idx" ON "StepUpGrant"("userId");
CREATE INDEX "StepUpGrant_sessionId_scope_idx" ON "StepUpGrant"("sessionId", "scope");
CREATE INDEX "StepUpGrant_deviceId_idx" ON "StepUpGrant"("deviceId");
CREATE INDEX "StepUpGrant_expiresAt_consumedAt_revokedAt_idx" ON "StepUpGrant"("expiresAt", "consumedAt", "revokedAt");
ALTER TABLE "StepUpGrant" ADD CONSTRAINT "StepUpGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StepUpGrant" ADD CONSTRAINT "StepUpGrant_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StepUpGrant" ADD CONSTRAINT "StepUpGrant_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
