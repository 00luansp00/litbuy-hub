ALTER TABLE "Order"
ADD COLUMN "feePolicyVersionId" UUID,
ADD COLUMN "platformCommissionRuleId" UUID;

ALTER TABLE "Order"
ADD CONSTRAINT "Order_platformFeeAmountMinor_nonnegative_check"
CHECK ("platformFeeAmountMinor" >= 0),
ADD CONSTRAINT "Order_platformFeeAmountMinor_lte_subtotal_check"
CHECK ("platformFeeAmountMinor" <= "subtotalAmountMinor"),
ADD CONSTRAINT "Order_platformFeeAmountMinor_lte_total_check"
CHECK ("platformFeeAmountMinor" <= "totalAmountMinor");

CREATE INDEX "Order_feePolicyVersionId_idx" ON "Order"("feePolicyVersionId");
CREATE INDEX "Order_platformCommissionRuleId_idx" ON "Order"("platformCommissionRuleId");

ALTER TABLE "Order"
ADD CONSTRAINT "Order_feePolicyVersionId_fkey"
FOREIGN KEY ("feePolicyVersionId") REFERENCES "FeePolicyVersion"("id")
ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "Order_platformCommissionRuleId_fkey"
FOREIGN KEY ("platformCommissionRuleId") REFERENCES "FeeRule"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
