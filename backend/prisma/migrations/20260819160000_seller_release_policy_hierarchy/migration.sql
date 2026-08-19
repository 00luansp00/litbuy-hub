CREATE TYPE "SellerReleasePolicyScope" AS ENUM ('DEFAULT', 'CATEGORY', 'SUBCATEGORY');

ALTER TABLE "SellerReleasePolicyRule"
  ADD COLUMN "scope" "SellerReleasePolicyScope",
  ADD COLUMN "categoryId" UUID,
  ADD COLUMN "subcategoryId" UUID;

-- The only rule shape supported by the GLOBAL ONLY foundation has this code.
-- Abort rather than assigning financial meaning to any unknown legacy shape.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "SellerReleasePolicyRule"
    WHERE "code" <> 'DELIVERY_PROTECTION_DEFAULT'
  ) THEN
    RAISE EXCEPTION 'SELLER_RELEASE_POLICY_LEGACY_RULE_NOT_DETERMINISTIC'
      USING ERRCODE = '23514';
  END IF;
END $$;

-- Published history is immutable at runtime. Temporarily disabling only the
-- rule guard permits this deterministic, meaning-preserving schema backfill.
ALTER TABLE "SellerReleasePolicyRule" DISABLE TRIGGER seller_release_policy_rule_immutable;
UPDATE "SellerReleasePolicyRule" SET "scope" = 'DEFAULT';
ALTER TABLE "SellerReleasePolicyRule" ENABLE TRIGGER seller_release_policy_rule_immutable;

ALTER TABLE "SellerReleasePolicyRule"
  ALTER COLUMN "scope" SET NOT NULL,
  ALTER COLUMN "scope" SET DEFAULT 'DEFAULT',
  ADD CONSTRAINT "SellerReleasePolicyRule_scope_qualifier_check" CHECK (
    ("scope" = 'DEFAULT' AND "categoryId" IS NULL AND "subcategoryId" IS NULL) OR
    ("scope" = 'CATEGORY' AND "categoryId" IS NOT NULL AND "subcategoryId" IS NULL) OR
    ("scope" = 'SUBCATEGORY' AND "categoryId" IS NULL AND "subcategoryId" IS NOT NULL)
  ),
  ADD CONSTRAINT "SellerReleasePolicyRule_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "CatalogCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "SellerReleasePolicyRule_subcategoryId_fkey"
    FOREIGN KEY ("subcategoryId") REFERENCES "CatalogSubcategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "SellerReleasePolicyRule_one_default_per_version"
  ON "SellerReleasePolicyRule" ("policyVersionId") WHERE "scope" = 'DEFAULT';
CREATE UNIQUE INDEX "SellerReleasePolicyRule_one_category_per_version"
  ON "SellerReleasePolicyRule" ("policyVersionId", "categoryId") WHERE "scope" = 'CATEGORY';
CREATE UNIQUE INDEX "SellerReleasePolicyRule_one_subcategory_per_version"
  ON "SellerReleasePolicyRule" ("policyVersionId", "subcategoryId") WHERE "scope" = 'SUBCATEGORY';

-- The legacy hold consumer remains DEFAULT-only, but DEFAULT identity is now
-- structural rather than tied to a commercial code string.
CREATE OR REPLACE FUNCTION financial_hold_release_snapshot_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE valid_policy boolean;
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
  IF NEW."sellerReleasePolicyVersionId" IS NOT NULL AND
     (TG_OP = 'INSERT' OR OLD."sellerReleasePolicyVersionId" IS NULL) THEN
    SELECT true INTO valid_policy
    FROM "SellerReleasePolicyVersion" p
    JOIN "SellerReleasePolicyRule" r ON r."policyVersionId" = p."id"
    WHERE p."id" = NEW."sellerReleasePolicyVersionId"
      AND r."id" = NEW."sellerReleasePolicyRuleId"
      AND r."scope" = 'DEFAULT'
      AND r."enabled" = true
      AND r."delayHours" = NEW."releaseDelayHours"
      AND p."status" = 'ACTIVE'
      AND p."effectiveFrom" <= NEW."releasePolicyAppliedAt"
      AND (p."effectiveTo" IS NULL OR p."effectiveTo" > NEW."releasePolicyAppliedAt")
    FOR SHARE OF p, r;
    IF valid_policy IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'FINANCIAL_HOLD_RELEASE_SNAPSHOT_POLICY_INVALID' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
