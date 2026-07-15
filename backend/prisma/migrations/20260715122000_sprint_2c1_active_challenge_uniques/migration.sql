CREATE UNIQUE INDEX "VerificationChallenge_2fa_enrollment_active_key"
ON "VerificationChallenge"("userId")
WHERE "purpose" = 'TWO_FACTOR_ENROLLMENT' AND "consumedAt" IS NULL;

CREATE UNIQUE INDEX "VerificationChallenge_2fa_login_active_key"
ON "VerificationChallenge"("userId", "deviceId")
WHERE "purpose" = 'TWO_FACTOR_LOGIN' AND "consumedAt" IS NULL;

CREATE UNIQUE INDEX "VerificationChallenge_2fa_disable_active_key"
ON "VerificationChallenge"("userId")
WHERE "purpose" = 'TWO_FACTOR_DISABLE' AND "consumedAt" IS NULL;
