ALTER TABLE "FinancialHold"
  DROP CONSTRAINT "FinancialHold_delivery_protection_valid_check";

ALTER TABLE "FinancialHold"
  ADD CONSTRAINT "FinancialHold_delivery_protection_valid_check" CHECK (
    "reason" <> 'DELIVERY_PROTECTION' OR (
      "orderId" IS NOT NULL
      AND "paymentId" IS NOT NULL
      AND "ledgerTransactionId" IS NOT NULL
      AND "amountMinor" > 0
      AND "currency" = 'BRL'
      AND "status" IN ('ACTIVE', 'RELEASE_ELIGIBLE')
      AND "releasedAt" IS NULL
      AND (
        "status" = 'ACTIVE'
        OR (
          "sellerReleasePolicyVersionId" IS NOT NULL
          AND "sellerReleasePolicyRuleId" IS NOT NULL
          AND "releaseDelayHours" IS NOT NULL
          AND "releaseDelayHours" >= 0
          AND "releasePolicyAppliedAt" IS NOT NULL
          AND "releaseEligibleAt" IS NOT NULL
        )
      )
    )
  );
