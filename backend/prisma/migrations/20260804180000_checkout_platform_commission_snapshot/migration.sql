ALTER TABLE "Order"
ADD COLUMN "feePolicyVersionId" UUID,
ADD COLUMN "platformCommissionRuleId" UUID;

ALTER TABLE "Order"
DROP CONSTRAINT "Order_total_check";

ALTER TABLE "Order"
ADD CONSTRAINT "Order_total_check"
CHECK ("totalAmountMinor" = "subtotalAmountMinor" - "discountAmountMinor"),
ADD CONSTRAINT "Order_platformFeeAmountMinor_nonnegative_check"
CHECK ("platformFeeAmountMinor" >= 0),
ADD CONSTRAINT "Order_platformFeeAmountMinor_lte_subtotal_check"
CHECK ("platformFeeAmountMinor" <= "subtotalAmountMinor"),
ADD CONSTRAINT "Order_platformFeeAmountMinor_lte_total_check"
CHECK ("platformFeeAmountMinor" <= "totalAmountMinor"),
ADD CONSTRAINT "Order_commission_snapshot_complete_check"
CHECK (
  ("feePolicyVersionId" IS NULL AND "platformCommissionRuleId" IS NULL)
  OR
  ("feePolicyVersionId" IS NOT NULL AND "platformCommissionRuleId" IS NOT NULL)
);

ALTER TABLE "FeeRule"
ADD CONSTRAINT "FeeRule_id_policyVersionId_key" UNIQUE ("id", "policyVersionId");

CREATE INDEX "Order_feePolicyVersionId_idx" ON "Order"("feePolicyVersionId");
CREATE INDEX "Order_platformCommissionRuleId_idx" ON "Order"("platformCommissionRuleId");

ALTER TABLE "Order"
ADD CONSTRAINT "Order_feePolicyVersionId_fkey"
FOREIGN KEY ("feePolicyVersionId") REFERENCES "FeePolicyVersion"("id")
ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "Order_platformCommissionRuleId_feePolicyVersionId_fkey"
FOREIGN KEY ("platformCommissionRuleId", "feePolicyVersionId") REFERENCES "FeeRule"("id", "policyVersionId")
ON DELETE RESTRICT ON UPDATE CASCADE;
