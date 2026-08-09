ALTER TABLE "FinancialHold"
  ADD COLUMN "sellerReleasePolicyVersionId" UUID,
  ADD COLUMN "sellerReleasePolicyRuleId" UUID,
  ADD COLUMN "releaseDelayHours" INTEGER,
  ADD COLUMN "releasePolicyAppliedAt" TIMESTAMP(3);

ALTER TABLE "SellerReleasePolicyRule"
  ADD CONSTRAINT "SellerReleasePolicyRule_id_policyVersionId_key" UNIQUE ("id", "policyVersionId");

ALTER TABLE "FinancialHold" ADD CONSTRAINT "FinancialHold_release_policy_rule_fkey"
  FOREIGN KEY ("sellerReleasePolicyRuleId", "sellerReleasePolicyVersionId")
  REFERENCES "SellerReleasePolicyRule"("id", "policyVersionId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FinancialHold" DROP CONSTRAINT "FinancialHold_delivery_protection_valid_check";
ALTER TABLE "FinancialHold" ADD CONSTRAINT "FinancialHold_delivery_protection_valid_check" CHECK (
  "reason" <> 'DELIVERY_PROTECTION' OR (
    "orderId" IS NOT NULL AND "paymentId" IS NOT NULL AND "ledgerTransactionId" IS NOT NULL
    AND "amountMinor" > 0 AND "currency" = 'BRL' AND "status" = 'ACTIVE'
    AND "releasedAt" IS NULL
  )
);
ALTER TABLE "FinancialHold" ADD CONSTRAINT "FinancialHold_release_snapshot_complete_check" CHECK (
  (
    "sellerReleasePolicyVersionId" IS NULL AND "sellerReleasePolicyRuleId" IS NULL
    AND "releaseDelayHours" IS NULL AND "releasePolicyAppliedAt" IS NULL
    AND "releaseEligibleAt" IS NULL
  ) OR (
    "reason" = 'DELIVERY_PROTECTION'
    AND "sellerReleasePolicyVersionId" IS NOT NULL AND "sellerReleasePolicyRuleId" IS NOT NULL
    AND "releaseDelayHours" IS NOT NULL AND "releaseDelayHours" >= 0
    AND "releasePolicyAppliedAt" IS NOT NULL AND "releaseEligibleAt" IS NOT NULL
    AND "releaseEligibleAt" = ("releasePolicyAppliedAt" + make_interval(hours => "releaseDelayHours"))::timestamp(3)
  )
);

CREATE FUNCTION financial_hold_release_snapshot_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."sellerReleasePolicyVersionId" IS NOT NULL AND (
    NEW."sellerReleasePolicyVersionId" IS DISTINCT FROM OLD."sellerReleasePolicyVersionId" OR
    NEW."sellerReleasePolicyRuleId" IS DISTINCT FROM OLD."sellerReleasePolicyRuleId" OR
    NEW."releaseDelayHours" IS DISTINCT FROM OLD."releaseDelayHours" OR
    NEW."releasePolicyAppliedAt" IS DISTINCT FROM OLD."releasePolicyAppliedAt" OR
    NEW."releaseEligibleAt" IS DISTINCT FROM OLD."releaseEligibleAt"
  ) THEN
    RAISE EXCEPTION 'FINANCIAL_HOLD_RELEASE_SNAPSHOT_IMMUTABLE' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER financial_hold_release_snapshot_immutable
  BEFORE UPDATE ON "FinancialHold" FOR EACH ROW
  EXECUTE FUNCTION financial_hold_release_snapshot_guard();
