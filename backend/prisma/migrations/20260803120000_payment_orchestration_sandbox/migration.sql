-- The preliminary generic charge has no commercial payment instrument yet.
ALTER TABLE "PaymentAttempt" ALTER COLUMN "method" DROP NOT NULL;

-- A reconciliation reference is unique per unresolved local ambiguity. This makes
-- best-effort materialization after a provider mutation safe to repeat.
CREATE UNIQUE INDEX "ReconciliationIssue_open_reference_key"
ON "ReconciliationIssue" ("providerCode", "referenceType", "referenceId")
WHERE "status" <> 'RESOLVED';
