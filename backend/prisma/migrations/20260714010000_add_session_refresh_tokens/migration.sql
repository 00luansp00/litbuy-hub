-- CreateTable
CREATE TABLE "SessionRefreshToken" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "replacedByTokenId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SessionRefreshToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SessionRefreshToken_tokenHash_key" ON "SessionRefreshToken"("tokenHash");
CREATE INDEX "SessionRefreshToken_sessionId_idx" ON "SessionRefreshToken"("sessionId");
CREATE INDEX "SessionRefreshToken_familyId_idx" ON "SessionRefreshToken"("familyId");
CREATE INDEX "SessionRefreshToken_tokenHash_idx" ON "SessionRefreshToken"("tokenHash");
CREATE INDEX "SessionRefreshToken_familyId_revokedAt_expiresAt_idx" ON "SessionRefreshToken"("familyId", "revokedAt", "expiresAt");
ALTER TABLE "SessionRefreshToken" ADD CONSTRAINT "SessionRefreshToken_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SessionRefreshToken" ADD CONSTRAINT "SessionRefreshToken_replacedByTokenId_fkey" FOREIGN KEY ("replacedByTokenId") REFERENCES "SessionRefreshToken"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill one historical record per existing session so deployed preview databases remain usable.
INSERT INTO "SessionRefreshToken" ("id", "sessionId", "familyId", "tokenHash", "expiresAt", "issuedAt", "createdAt")
SELECT gen_random_uuid(), "id", "refreshTokenFamilyId", "refreshTokenHash", "expiresAt", "createdAt", CURRENT_TIMESTAMP
FROM "Session"
ON CONFLICT ("tokenHash") DO NOTHING;
