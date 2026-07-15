CREATE UNIQUE INDEX "VerificationChallenge_one_active_phone_per_user"
ON "VerificationChallenge"("userId", "purpose")
WHERE "purpose" = 'PHONE_VERIFICATION'
AND "consumedAt" IS NULL;

CREATE UNIQUE INDEX "EmailChangeRequest_one_pending_per_user"
ON "EmailChangeRequest"("userId")
WHERE "completedAt" IS NULL
AND "cancelledAt" IS NULL;
