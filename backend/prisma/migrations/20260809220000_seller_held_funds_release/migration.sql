ALTER TABLE "FinancialHold"
  ADD COLUMN "releaseLedgerTransactionId" UUID;

CREATE UNIQUE INDEX "FinancialHold_releaseLedgerTransactionId_key"
  ON "FinancialHold"("releaseLedgerTransactionId");

ALTER TABLE "FinancialHold"
  ADD CONSTRAINT "FinancialHold_releaseLedgerTransactionId_fkey"
  FOREIGN KEY ("releaseLedgerTransactionId") REFERENCES "LedgerTransaction"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "LedgerTransaction_one_seller_funds_release_per_hold"
  ON "LedgerTransaction"("referenceId")
  WHERE "type" = 'SELLER_FUNDS_RELEASED'
    AND "referenceType" = 'FinancialHoldRelease';

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
      AND "status" IN ('ACTIVE', 'RELEASE_ELIGIBLE', 'RELEASED')
      AND (
        ("status" = 'ACTIVE' AND "releasedAt" IS NULL
          AND "releaseLedgerTransactionId" IS NULL)
        OR ("status" = 'RELEASE_ELIGIBLE'
          AND "sellerReleasePolicyVersionId" IS NOT NULL
          AND "sellerReleasePolicyRuleId" IS NOT NULL
          AND "releaseDelayHours" IS NOT NULL AND "releaseDelayHours" >= 0
          AND "releasePolicyAppliedAt" IS NOT NULL
          AND "releaseEligibleAt" IS NOT NULL
          AND "releasedAt" IS NULL AND "releaseLedgerTransactionId" IS NULL)
        OR ("status" = 'RELEASED'
          AND "sellerReleasePolicyVersionId" IS NOT NULL
          AND "sellerReleasePolicyRuleId" IS NOT NULL
          AND "releaseDelayHours" IS NOT NULL AND "releaseDelayHours" >= 0
          AND "releasePolicyAppliedAt" IS NOT NULL
          AND "releaseEligibleAt" IS NOT NULL
          AND "releasedAt" IS NOT NULL AND "releaseLedgerTransactionId" IS NOT NULL)
      )
    )
  );

CREATE OR REPLACE FUNCTION financial_hold_delivery_protection_lifecycle_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW."reason" = 'DELIVERY_PROTECTION'
     AND NEW."status" <> 'ACTIVE' THEN
    RAISE EXCEPTION 'DELIVERY_PROTECTION_MUST_START_ACTIVE' USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'UPDATE' AND OLD."reason" = 'DELIVERY_PROTECTION' THEN
    IF NEW."reason" <> 'DELIVERY_PROTECTION' THEN
      RAISE EXCEPTION 'DELIVERY_PROTECTION_REASON_IMMUTABLE' USING ERRCODE = '23514';
    END IF;
    IF NOT (
      (OLD."status" = 'ACTIVE' AND NEW."status" IN ('ACTIVE', 'RELEASE_ELIGIBLE'))
      OR (OLD."status" = 'RELEASE_ELIGIBLE' AND NEW."status" IN ('RELEASE_ELIGIBLE', 'RELEASED'))
      OR (OLD."status" = 'RELEASED' AND NEW."status" = 'RELEASED')
    ) THEN
      RAISE EXCEPTION 'DELIVERY_PROTECTION_STATUS_TRANSITION_INVALID' USING ERRCODE = '23514';
    END IF;
    IF OLD."releaseLedgerTransactionId" IS NOT NULL
       AND NEW."releaseLedgerTransactionId" IS DISTINCT FROM OLD."releaseLedgerTransactionId" THEN
      RAISE EXCEPTION 'FINANCIAL_HOLD_RELEASE_TRANSACTION_IMMUTABLE' USING ERRCODE = '23514';
    END IF;
    IF OLD."releasedAt" IS NOT NULL AND NEW."releasedAt" IS DISTINCT FROM OLD."releasedAt" THEN
      RAISE EXCEPTION 'FINANCIAL_HOLD_RELEASED_AT_IMMUTABLE' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD."reason" <> 'DELIVERY_PROTECTION'
     AND NEW."reason" = 'DELIVERY_PROTECTION' AND NEW."status" <> 'ACTIVE' THEN
    RAISE EXCEPTION 'DELIVERY_PROTECTION_MUST_START_ACTIVE' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
