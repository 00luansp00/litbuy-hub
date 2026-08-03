-- The first provider orchestration represents only Efí's generic Billing charge.
ALTER TYPE "PaymentMethod" ADD VALUE 'BILLING' BEFORE 'PIX';

-- A reconciliation reference is unique per unresolved local ambiguity. This makes
-- best-effort materialization after a provider mutation safe to repeat.
CREATE UNIQUE INDEX "ReconciliationIssue_open_reference_key"
ON "ReconciliationIssue" ("providerCode", "referenceType", "referenceId")
WHERE "status" <> 'RESOLVED';
