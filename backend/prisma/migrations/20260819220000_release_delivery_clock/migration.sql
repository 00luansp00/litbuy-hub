-- OrderDelivery.createdAt is the authoritative, database-originated delivery clock.
-- Existing rows are intentionally untouched.
CREATE FUNCTION order_delivery_created_at_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW."createdAt" := transaction_timestamp()::timestamp(3);
  ELSIF NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN
    RAISE EXCEPTION 'ORDER_DELIVERY_CREATED_AT_IMMUTABLE' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER "OrderDelivery_createdAt_guard"
BEFORE INSERT OR UPDATE ON "OrderDelivery" FOR EACH ROW
EXECUTE FUNCTION order_delivery_created_at_guard();

-- Preserve all historical FinancialHold rows. Only a new delivery-protection
-- hold, or completion of a legacy empty snapshot, is checked against delivery.
CREATE OR REPLACE FUNCTION financial_hold_release_snapshot_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  valid_snapshot boolean;
  order_snapshot "Order"%ROWTYPE;
  delivery_snapshot "OrderDelivery"%ROWTYPE;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD."sellerReleasePolicyVersionId" IS NOT NULL AND (
    NEW."sellerReleasePolicyVersionId" IS DISTINCT FROM OLD."sellerReleasePolicyVersionId" OR
    NEW."sellerReleasePolicyRuleId" IS DISTINCT FROM OLD."sellerReleasePolicyRuleId" OR
    NEW."releaseDelayHours" IS DISTINCT FROM OLD."releaseDelayHours" OR
    NEW."releasePolicyAppliedAt" IS DISTINCT FROM OLD."releasePolicyAppliedAt" OR
    NEW."releaseEligibleAt" IS DISTINCT FROM OLD."releaseEligibleAt"
  ) THEN
    RAISE EXCEPTION 'FINANCIAL_HOLD_RELEASE_SNAPSHOT_IMMUTABLE' USING ERRCODE = '55000';
  END IF;

  IF NEW."reason" = 'DELIVERY_PROTECTION'
     AND NEW."sellerReleasePolicyVersionId" IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD."sellerReleasePolicyVersionId" IS NULL) THEN
    SELECT * INTO order_snapshot FROM "Order" WHERE "id" = NEW."orderId" FOR SHARE;
    SELECT * INTO delivery_snapshot FROM "OrderDelivery"
      WHERE "orderId" = NEW."orderId" FOR SHARE;

    IF delivery_snapshot."id" IS NULL
       OR delivery_snapshot."sellerProfileId" IS DISTINCT FROM NEW."sellerProfileId"
       OR NEW."releasePolicyAppliedAt" IS DISTINCT FROM delivery_snapshot."createdAt"
       OR NEW."releaseEligibleAt" IS DISTINCT FROM
          (delivery_snapshot."createdAt" + make_interval(hours => NEW."releaseDelayHours"))::timestamp(3) THEN
      RAISE EXCEPTION 'FINANCIAL_HOLD_DELIVERY_CLOCK_INVALID' USING ERRCODE = '23514';
    END IF;

    IF order_snapshot."sellerReleasePolicyVersionId" IS NOT NULL THEN
      valid_snapshot := order_snapshot."sellerReleasePolicyVersionId" = NEW."sellerReleasePolicyVersionId"
        AND order_snapshot."sellerReleasePolicyRuleId" = NEW."sellerReleasePolicyRuleId"
        AND order_snapshot."frozenBaseReleaseDelayHours" = NEW."releaseDelayHours";
    ELSE
      -- Legacy Orders keep the historical current-DEFAULT policy resolution;
      -- policy authority is independent from the delivery clock authority.
      SELECT true INTO valid_snapshot
      FROM "SellerReleasePolicyVersion" p
      JOIN "SellerReleasePolicyRule" r ON r."policyVersionId" = p."id"
      WHERE p."id" = NEW."sellerReleasePolicyVersionId"
        AND r."id" = NEW."sellerReleasePolicyRuleId"
        AND r."scope" = 'DEFAULT' AND r."enabled"
        AND r."delayHours" = NEW."releaseDelayHours"
        AND p."status" = 'ACTIVE'
        AND p."effectiveFrom" <= transaction_timestamp()
        AND (p."effectiveTo" IS NULL OR p."effectiveTo" > transaction_timestamp())
      FOR SHARE OF p, r;
    END IF;
    IF valid_snapshot IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'FINANCIAL_HOLD_RELEASE_SNAPSHOT_POLICY_INVALID' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
