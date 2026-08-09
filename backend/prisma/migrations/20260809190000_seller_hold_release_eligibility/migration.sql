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

CREATE FUNCTION financial_hold_delivery_protection_lifecycle_guard()
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
      OR (OLD."status" = 'RELEASE_ELIGIBLE' AND NEW."status" = 'RELEASE_ELIGIBLE')
    ) THEN
      RAISE EXCEPTION 'DELIVERY_PROTECTION_STATUS_TRANSITION_INVALID' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD."reason" <> 'DELIVERY_PROTECTION'
     AND NEW."reason" = 'DELIVERY_PROTECTION' AND NEW."status" <> 'ACTIVE' THEN
    RAISE EXCEPTION 'DELIVERY_PROTECTION_MUST_START_ACTIVE' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER financial_hold_delivery_protection_lifecycle
  BEFORE INSERT OR UPDATE ON "FinancialHold" FOR EACH ROW
  EXECUTE FUNCTION financial_hold_delivery_protection_lifecycle_guard();
