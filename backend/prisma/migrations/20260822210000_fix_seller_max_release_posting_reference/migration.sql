CREATE OR REPLACE FUNCTION financial_hold_delivery_protection_lifecycle_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  release_order "Order"%ROWTYPE;
  release_posting "LedgerTransaction"%ROWTYPE;
  effective_boundary timestamp(3);
  k_absent boolean;
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

    IF OLD."status" = 'RELEASE_ELIGIBLE' AND NEW."status" = 'RELEASED' THEN
      SELECT * INTO release_order FROM "Order" WHERE "id" = NEW."orderId" FOR SHARE;
      IF release_order."id" IS NULL THEN
        RAISE EXCEPTION 'FINANCIAL_HOLD_RELEASE_ORDER_INVALID' USING ERRCODE = '23514';
      END IF;

      k_absent := release_order."sellerMaxReleaseCalculationVersion" IS NULL
        AND release_order."sellerMaxReleaseReductionHours" IS NULL
        AND release_order."sellerMaxReleaseTargetAt" IS NULL
        AND release_order."sellerMaxEffectiveReleaseAt" IS NULL;

      IF k_absent THEN
        effective_boundary := NEW."releaseEligibleAt";
      ELSIF release_order."sellerMaxReleaseCalculationVersion" = 1
        AND release_order."sellerPlanSnapshot" = 'LIT_MAX'
        AND release_order."sellerMaxQualificationVersion" = 1
        AND release_order."sellerMaxQualificationStatus" = 'QUALIFIED'
        AND release_order."sellerMaxEffectiveReleaseAt" IS NOT NULL
        AND release_order."sellerMaxEffectiveReleaseAt" <= NEW."releaseEligibleAt" THEN
        effective_boundary := release_order."sellerMaxEffectiveReleaseAt";
      ELSIF release_order."sellerMaxReleaseCalculationVersion" = 1
        AND release_order."sellerPlanSnapshot" = 'LIT_MAX'
        AND release_order."sellerMaxQualificationVersion" = 1
        AND release_order."sellerMaxQualificationStatus" IN ('PENDING', 'EXPIRED')
        AND (release_order."sellerMaxQualificationStatus" = 'PENDING'
          OR release_order."sellerMaxEffectiveReleaseAt" IS NOT DISTINCT FROM NEW."releaseEligibleAt") THEN
        effective_boundary := NEW."releaseEligibleAt";
      ELSE
        RAISE EXCEPTION 'FINANCIAL_HOLD_RELEASE_K_SNAPSHOT_INVALID' USING ERRCODE = '23514';
      END IF;

      IF effective_boundary IS NULL OR NEW."releasedAt" IS NULL
         OR NEW."releasedAt" < effective_boundary THEN
        RAISE EXCEPTION 'FINANCIAL_HOLD_RELEASE_BEFORE_EFFECTIVE_DEADLINE' USING ERRCODE = '23514';
      END IF;

      SELECT * INTO release_posting FROM "LedgerTransaction"
        WHERE "id" = NEW."releaseLedgerTransactionId" FOR SHARE;
      IF release_posting."id" IS NULL
        OR release_posting."type" <> 'SELLER_FUNDS_RELEASED'
        OR release_posting."referenceType" <> 'FinancialHoldRelease'
        OR release_posting."referenceId" IS DISTINCT FROM NEW."id"
        OR release_posting."currency" <> NEW."currency"
        OR release_posting."createdAt" IS DISTINCT FROM NEW."releasedAt" THEN
        RAISE EXCEPTION 'FINANCIAL_HOLD_RELEASE_POSTING_INVALID' USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD."reason" <> 'DELIVERY_PROTECTION'
     AND NEW."reason" = 'DELIVERY_PROTECTION' AND NEW."status" <> 'ACTIVE' THEN
    RAISE EXCEPTION 'DELIVERY_PROTECTION_MUST_START_ACTIVE' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
