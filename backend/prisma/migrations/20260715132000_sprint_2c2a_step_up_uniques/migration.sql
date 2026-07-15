CREATE UNIQUE INDEX "StepUpGrant_active_session_scope_unique" ON "StepUpGrant"("sessionId", "scope") WHERE "consumedAt" IS NULL AND "revokedAt" IS NULL;
CREATE UNIQUE INDEX "VerificationChallenge_active_step_up_scope_unique" ON "VerificationChallenge"("userId", "deviceId", "contextId", "targetHash") WHERE "purpose" = 'TWO_FACTOR_STEP_UP' AND "consumedAt" IS NULL;
CREATE UNIQUE INDEX "VerificationChallenge_active_method_change_user_unique" ON "VerificationChallenge"("userId") WHERE "purpose" = 'TWO_FACTOR_METHOD_CHANGE' AND "consumedAt" IS NULL;
