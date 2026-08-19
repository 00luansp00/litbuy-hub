ALTER TABLE "Order"
  ADD COLUMN "sellerReleasePolicyVersionId" UUID,
  ADD COLUMN "sellerReleasePolicyRuleId" UUID,
  ADD COLUMN "sellerReleasePolicySource" "SellerReleasePolicyScope",
  ADD COLUMN "sellerReleasePolicyCategoryId" UUID,
  ADD COLUMN "sellerReleasePolicySubcategoryId" UUID,
  ADD COLUMN "frozenBaseReleaseDelayHours" INTEGER;

ALTER TABLE "Order" ADD CONSTRAINT "Order_release_policy_snapshot_shape_check" CHECK (
  ("sellerReleasePolicyVersionId" IS NULL AND "sellerReleasePolicyRuleId" IS NULL
    AND "sellerReleasePolicySource" IS NULL AND "sellerReleasePolicyCategoryId" IS NULL
    AND "sellerReleasePolicySubcategoryId" IS NULL AND "frozenBaseReleaseDelayHours" IS NULL)
  OR
  ("sellerReleasePolicyVersionId" IS NOT NULL AND "sellerReleasePolicyRuleId" IS NOT NULL
    AND "sellerReleasePolicySource" IS NOT NULL AND "sellerReleasePolicyCategoryId" IS NOT NULL
    AND "frozenBaseReleaseDelayHours" IS NOT NULL AND "frozenBaseReleaseDelayHours" >= 0)
);

CREATE INDEX "Order_sellerReleasePolicyVersionId_idx" ON "Order"("sellerReleasePolicyVersionId");
CREATE INDEX "Order_sellerReleasePolicyRuleId_idx" ON "Order"("sellerReleasePolicyRuleId");
CREATE INDEX "Order_sellerReleasePolicyCategoryId_idx" ON "Order"("sellerReleasePolicyCategoryId");
CREATE INDEX "Order_sellerReleasePolicySubcategoryId_idx" ON "Order"("sellerReleasePolicySubcategoryId");

ALTER TABLE "Order"
  ADD CONSTRAINT "Order_sellerReleasePolicyVersionId_fkey" FOREIGN KEY ("sellerReleasePolicyVersionId") REFERENCES "SellerReleasePolicyVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "Order_sellerReleasePolicyRuleId_versionId_fkey" FOREIGN KEY ("sellerReleasePolicyRuleId", "sellerReleasePolicyVersionId") REFERENCES "SellerReleasePolicyRule"("id", "policyVersionId") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "Order_sellerReleasePolicyCategoryId_fkey" FOREIGN KEY ("sellerReleasePolicyCategoryId") REFERENCES "CatalogCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "Order_sellerReleasePolicySubcategoryId_fkey" FOREIGN KEY ("sellerReleasePolicySubcategoryId") REFERENCES "CatalogSubcategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION order_release_policy_snapshot_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE valid_snapshot boolean;
BEGIN
  IF TG_OP = 'UPDATE' AND (
    NEW."sellerReleasePolicyVersionId" IS DISTINCT FROM OLD."sellerReleasePolicyVersionId" OR
    NEW."sellerReleasePolicyRuleId" IS DISTINCT FROM OLD."sellerReleasePolicyRuleId" OR
    NEW."sellerReleasePolicySource" IS DISTINCT FROM OLD."sellerReleasePolicySource" OR
    NEW."sellerReleasePolicyCategoryId" IS DISTINCT FROM OLD."sellerReleasePolicyCategoryId" OR
    NEW."sellerReleasePolicySubcategoryId" IS DISTINCT FROM OLD."sellerReleasePolicySubcategoryId" OR
    NEW."frozenBaseReleaseDelayHours" IS DISTINCT FROM OLD."frozenBaseReleaseDelayHours"
  ) THEN
    RAISE EXCEPTION 'ORDER_RELEASE_POLICY_SNAPSHOT_IMMUTABLE' USING ERRCODE = '55000';
  END IF;

  IF TG_OP = 'INSERT' AND NEW."sellerReleasePolicyVersionId" IS NOT NULL THEN
    SELECT true INTO valid_snapshot
    FROM "SellerReleasePolicyVersion" p
    JOIN "SellerReleasePolicyRule" r ON r."policyVersionId" = p."id"
    LEFT JOIN "CatalogSubcategory" s ON s."id" = NEW."sellerReleasePolicySubcategoryId"
    WHERE p."id" = NEW."sellerReleasePolicyVersionId"
      AND r."id" = NEW."sellerReleasePolicyRuleId"
      AND r."enabled" = true
      AND r."delayHours" = NEW."frozenBaseReleaseDelayHours"
      AND r."scope" = NEW."sellerReleasePolicySource"
      AND p."status" = 'ACTIVE'
      AND p."effectiveFrom" <= transaction_timestamp()
      AND (p."effectiveTo" IS NULL OR p."effectiveTo" > transaction_timestamp())
      AND (NEW."sellerReleasePolicySubcategoryId" IS NULL OR s."categoryId" = NEW."sellerReleasePolicyCategoryId")
      AND (
        (r."scope" = 'DEFAULT' AND r."categoryId" IS NULL AND r."subcategoryId" IS NULL) OR
        (r."scope" = 'CATEGORY' AND r."categoryId" = NEW."sellerReleasePolicyCategoryId" AND r."subcategoryId" IS NULL) OR
        (r."scope" = 'SUBCATEGORY' AND r."categoryId" IS NULL AND r."subcategoryId" = NEW."sellerReleasePolicySubcategoryId")
      )
    FOR SHARE OF p, r;
    IF valid_snapshot IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'ORDER_RELEASE_POLICY_SNAPSHOT_INVALID' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER "Order_release_policy_snapshot_guard"
BEFORE INSERT OR UPDATE ON "Order" FOR EACH ROW EXECUTE FUNCTION order_release_policy_snapshot_guard();

-- New Orders inherit their immutable checkout snapshot. Legacy Orders retain
-- the original DEFAULT/effective-at-hold-time validation path.
CREATE OR REPLACE FUNCTION financial_hold_release_snapshot_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE valid_snapshot boolean; order_snapshot "Order"%ROWTYPE;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD."sellerReleasePolicyVersionId" IS NOT NULL AND (
    NEW."sellerReleasePolicyVersionId" IS DISTINCT FROM OLD."sellerReleasePolicyVersionId" OR
    NEW."sellerReleasePolicyRuleId" IS DISTINCT FROM OLD."sellerReleasePolicyRuleId" OR
    NEW."releaseDelayHours" IS DISTINCT FROM OLD."releaseDelayHours" OR
    NEW."releasePolicyAppliedAt" IS DISTINCT FROM OLD."releasePolicyAppliedAt" OR
    NEW."releaseEligibleAt" IS DISTINCT FROM OLD."releaseEligibleAt"
  ) THEN RAISE EXCEPTION 'FINANCIAL_HOLD_RELEASE_SNAPSHOT_IMMUTABLE' USING ERRCODE = '55000'; END IF;
  IF NEW."sellerReleasePolicyVersionId" IS NOT NULL AND (TG_OP = 'INSERT' OR OLD."sellerReleasePolicyVersionId" IS NULL) THEN
    SELECT * INTO order_snapshot FROM "Order" WHERE "id" = NEW."orderId" FOR SHARE;
    IF order_snapshot."sellerReleasePolicyVersionId" IS NOT NULL THEN
      valid_snapshot := order_snapshot."sellerReleasePolicyVersionId" = NEW."sellerReleasePolicyVersionId"
        AND order_snapshot."sellerReleasePolicyRuleId" = NEW."sellerReleasePolicyRuleId"
        AND order_snapshot."frozenBaseReleaseDelayHours" = NEW."releaseDelayHours";
    ELSE
      SELECT true INTO valid_snapshot FROM "SellerReleasePolicyVersion" p JOIN "SellerReleasePolicyRule" r ON r."policyVersionId" = p."id"
      WHERE p."id" = NEW."sellerReleasePolicyVersionId" AND r."id" = NEW."sellerReleasePolicyRuleId"
        AND r."scope" = 'DEFAULT' AND r."enabled" AND r."delayHours" = NEW."releaseDelayHours"
        AND p."status" = 'ACTIVE' AND p."effectiveFrom" <= NEW."releasePolicyAppliedAt"
        AND (p."effectiveTo" IS NULL OR p."effectiveTo" > NEW."releasePolicyAppliedAt") FOR SHARE OF p, r;
    END IF;
    IF valid_snapshot IS DISTINCT FROM true THEN RAISE EXCEPTION 'FINANCIAL_HOLD_RELEASE_SNAPSHOT_POLICY_INVALID' USING ERRCODE = '23514'; END IF;
  END IF;
  RETURN NEW;
END $$;
