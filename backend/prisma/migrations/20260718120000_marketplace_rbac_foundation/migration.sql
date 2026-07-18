-- Persistent marketplace RBAC foundation.
CREATE TYPE "PlatformRole" AS ENUM ('BUYER', 'SELLER', 'ADMIN');

ALTER TYPE "SecurityEventType" ADD VALUE 'ROLE_GRANTED';
ALTER TYPE "SecurityEventType" ADD VALUE 'ROLE_REVOKED';

CREATE TABLE "UserRoleAssignment" (
    "userId" UUID NOT NULL,
    "role" "PlatformRole" NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserRoleAssignment_pkey" PRIMARY KEY ("userId", "role")
);

CREATE INDEX "UserRoleAssignment_role_idx" ON "UserRoleAssignment"("role");

ALTER TABLE "UserRoleAssignment" ADD CONSTRAINT "UserRoleAssignment_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "UserRoleAssignment" ("userId", "role")
SELECT "id", 'BUYER'::"PlatformRole"
FROM "User"
ON CONFLICT ("userId", "role") DO NOTHING;
