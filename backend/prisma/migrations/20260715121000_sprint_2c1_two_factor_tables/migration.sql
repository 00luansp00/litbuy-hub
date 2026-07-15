CREATE TABLE "TwoFactorSettings" (
    "userId" UUID NOT NULL,
    "method" "TwoFactorMethod" NOT NULL,
    "enabledAt" TIMESTAMP(3) NOT NULL,
    "disabledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TwoFactorSettings_pkey" PRIMARY KEY ("userId")
);
CREATE TABLE "TwoFactorRecoveryCode" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "codeHash" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TwoFactorRecoveryCode_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TwoFactorRecoveryCode_codeHash_key" ON "TwoFactorRecoveryCode"("codeHash");
CREATE INDEX "TwoFactorSettings_disabledAt_idx" ON "TwoFactorSettings"("disabledAt");
CREATE INDEX "TwoFactorRecoveryCode_userId_usedAt_idx" ON "TwoFactorRecoveryCode"("userId", "usedAt");
ALTER TABLE "TwoFactorSettings" ADD CONSTRAINT "TwoFactorSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TwoFactorRecoveryCode" ADD CONSTRAINT "TwoFactorRecoveryCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
