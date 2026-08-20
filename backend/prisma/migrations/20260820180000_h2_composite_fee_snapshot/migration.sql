CREATE TYPE "OrderFeeComponentKind" AS ENUM ('LISTING_TIER');
ALTER TABLE "Order" ADD COLUMN "feeSnapshotVersion" INTEGER;
ALTER TABLE "Order" ADD CONSTRAINT "Order_feeSnapshotVersion_check" CHECK ("feeSnapshotVersion" IS NULL OR "feeSnapshotVersion" = 1);
CREATE TABLE "OrderFeeComponentSnapshot" (
  "id" UUID NOT NULL, "orderId" UUID NOT NULL, "componentKind" "OrderFeeComponentKind" NOT NULL,
  "feePolicyVersionId" UUID NOT NULL, "feeRuleId" UUID NOT NULL, "pricingPolicyVersion" INTEGER NOT NULL,
  "listingTier" "ListingDraftPromotionPreference" NOT NULL, "category" "FeeRuleCategory" NOT NULL,
  "partyCharged" "FeeParty" NOT NULL, "formula" "FeeFormula" NOT NULL, "percentBps" INTEGER NOT NULL,
  "baseAmountMinor" BIGINT NOT NULL, "feeAmountMinor" BIGINT NOT NULL, "currency" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderFeeComponentSnapshot_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OrderFeeComponentSnapshot_listing_tier_shape_check" CHECK (
    "componentKind" = 'LISTING_TIER' AND "category" = 'PLATFORM_COMMISSION' AND "partyCharged" = 'SELLER'
    AND "formula" = 'PERCENT_BPS' AND "percentBps" >= 0 AND "baseAmountMinor" >= 0
    AND "feeAmountMinor" >= 0 AND "pricingPolicyVersion" > 0 AND "currency" = 'BRL')
);
CREATE UNIQUE INDEX "OrderFeeComponentSnapshot_orderId_componentKind_key" ON "OrderFeeComponentSnapshot"("orderId", "componentKind");
CREATE INDEX "OrderFeeComponentSnapshot_feePolicyVersionId_idx" ON "OrderFeeComponentSnapshot"("feePolicyVersionId");
CREATE INDEX "OrderFeeComponentSnapshot_feeRuleId_idx" ON "OrderFeeComponentSnapshot"("feeRuleId");
ALTER TABLE "OrderFeeComponentSnapshot"
 ADD CONSTRAINT "OrderFeeComponentSnapshot_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 ADD CONSTRAINT "OrderFeeComponentSnapshot_feePolicyVersionId_fkey" FOREIGN KEY ("feePolicyVersionId") REFERENCES "FeePolicyVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 ADD CONSTRAINT "OrderFeeComponentSnapshot_feeRuleId_feePolicyVersionId_fkey" FOREIGN KEY ("feeRuleId", "feePolicyVersionId") REFERENCES "FeeRule"("id", "policyVersionId") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE FUNCTION validate_order_fee_component_snapshot() RETURNS TRIGGER AS $$
DECLARE parent "Order"%ROWTYPE; policy "FeePolicyVersion"%ROWTYPE; rule "FeeRule"%ROWTYPE;
BEGIN
 SELECT * INTO parent FROM "Order" WHERE "id" = NEW."orderId";
 SELECT * INTO policy FROM "FeePolicyVersion" WHERE "id" = NEW."feePolicyVersionId";
 SELECT * INTO rule FROM "FeeRule" WHERE "id" = NEW."feeRuleId" AND "policyVersionId" = NEW."feePolicyVersionId";
 IF parent."feeSnapshotVersion" IS DISTINCT FROM 1
 OR parent."feePolicyVersionId" IS DISTINCT FROM NEW."feePolicyVersionId"
 OR parent."platformCommissionRuleId" IS DISTINCT FROM NEW."feeRuleId"
 OR parent."pricingPolicyVersion" IS DISTINCT FROM NEW."pricingPolicyVersion"
 OR parent."platformFeeAmountMinor" IS DISTINCT FROM NEW."feeAmountMinor"
 OR parent."subtotalAmountMinor" IS DISTINCT FROM NEW."baseAmountMinor"
 OR parent."totalAmountMinor" IS DISTINCT FROM parent."subtotalAmountMinor"
 OR parent."currency" IS DISTINCT FROM NEW."currency"
 OR policy."publicVersion" IS DISTINCT FROM NEW."pricingPolicyVersion"
 OR rule."category" IS DISTINCT FROM NEW."category" OR rule."partyCharged" IS DISTINCT FROM NEW."partyCharged"
 OR rule."formula" IS DISTINCT FROM NEW."formula" OR rule."percentBps" IS DISTINCT FROM NEW."percentBps"
 OR rule."promotionTier" IS DISTINCT FROM NEW."listingTier"::text
 OR rule."enabled" IS DISTINCT FROM TRUE
 OR rule."fixedAmountMinor" IS NOT NULL OR rule."minimumAmountMinor" IS NOT NULL OR rule."maximumAmountMinor" IS NOT NULL
 OR rule."paymentMethod" IS NOT NULL OR rule."installmentsFrom" IS NOT NULL OR rule."installmentsTo" IS NOT NULL
 OR rule."sellerLevel" IS NOT NULL OR rule."sellerPlan" IS NOT NULL
 OR rule."withdrawalSpeed" IS NOT NULL OR rule."productType" IS NOT NULL
 OR NEW."feeAmountMinor" IS DISTINCT FROM ((NEW."baseAmountMinor" * NEW."percentBps") / 10000)
 THEN RAISE EXCEPTION 'ORDER_FEE_COMPONENT_SNAPSHOT_INCONSISTENT' USING ERRCODE = '23514'; END IF;
 RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "OrderFeeComponentSnapshot_validate" BEFORE INSERT ON "OrderFeeComponentSnapshot" FOR EACH ROW EXECUTE FUNCTION validate_order_fee_component_snapshot();
CREATE FUNCTION prevent_order_fee_component_snapshot_mutation() RETURNS TRIGGER AS $$
BEGIN RAISE EXCEPTION 'ORDER_FEE_COMPONENT_SNAPSHOT_IMMUTABLE' USING ERRCODE = '55000'; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "OrderFeeComponentSnapshot_immutable" BEFORE UPDATE OR DELETE ON "OrderFeeComponentSnapshot" FOR EACH ROW EXECUTE FUNCTION prevent_order_fee_component_snapshot_mutation();
CREATE OR REPLACE FUNCTION prevent_order_pricing_snapshot_update() RETURNS TRIGGER AS $$
BEGIN
 IF OLD."feePolicyVersionId" IS DISTINCT FROM NEW."feePolicyVersionId"
 OR OLD."platformCommissionRuleId" IS DISTINCT FROM NEW."platformCommissionRuleId"
 OR OLD."pricingPolicyVersion" IS DISTINCT FROM NEW."pricingPolicyVersion"
 OR OLD."platformFeeAmountMinor" IS DISTINCT FROM NEW."platformFeeAmountMinor"
 OR OLD."feeSnapshotVersion" IS DISTINCT FROM NEW."feeSnapshotVersion"
 THEN RAISE EXCEPTION 'ORDER_PRICING_SNAPSHOT_IMMUTABLE' USING ERRCODE = '55000'; END IF;
 RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE FUNCTION require_h2_listing_tier_component() RETURNS TRIGGER AS $$
DECLARE component_count INTEGER;
BEGIN
 IF NEW."feeSnapshotVersion" = 1 THEN
  SELECT count(*) INTO component_count FROM "OrderFeeComponentSnapshot" WHERE "orderId" = NEW."id" AND "componentKind" = 'LISTING_TIER';
  IF component_count <> 1 THEN RAISE EXCEPTION 'H2_LISTING_TIER_COMPONENT_REQUIRED' USING ERRCODE = '23514'; END IF;
 END IF;
 RETURN NULL;
END; $$ LANGUAGE plpgsql;
CREATE CONSTRAINT TRIGGER "Order_h2_listing_tier_component_required" AFTER INSERT ON "Order" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION require_h2_listing_tier_component();
