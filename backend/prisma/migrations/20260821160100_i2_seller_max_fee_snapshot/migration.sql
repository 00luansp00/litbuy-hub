ALTER TABLE "OrderFeeComponentSnapshot" ALTER COLUMN "listingTier" DROP NOT NULL;
ALTER TABLE "OrderFeeComponentSnapshot" ADD COLUMN "sellerPlan" "ListingDraftSellerPlanPreference";
ALTER TABLE "Order" DROP CONSTRAINT "Order_feeSnapshotVersion_check";
ALTER TABLE "Order" ADD CONSTRAINT "Order_feeSnapshotVersion_check" CHECK ("feeSnapshotVersion" IS NULL OR "feeSnapshotVersion" IN (1, 2));
ALTER TABLE "OrderFeeComponentSnapshot" DROP CONSTRAINT "OrderFeeComponentSnapshot_listing_tier_shape_check";
ALTER TABLE "OrderFeeComponentSnapshot" ADD CONSTRAINT "OrderFeeComponentSnapshot_component_shape_check" CHECK (
 ("componentKind" = 'LISTING_TIER' AND "listingTier" IS NOT NULL AND "sellerPlan" IS NULL AND "category" = 'PLATFORM_COMMISSION') OR
 ("componentKind" = 'SELLER_MAX' AND "listingTier" IS NULL AND "sellerPlan" = 'LIT_MAX' AND "category" = 'LIT_MAX_PRICE')
) NOT VALID;
ALTER TABLE "OrderFeeComponentSnapshot" VALIDATE CONSTRAINT "OrderFeeComponentSnapshot_component_shape_check";

CREATE OR REPLACE FUNCTION validate_order_fee_component_snapshot() RETURNS TRIGGER AS $$
DECLARE parent "Order"%ROWTYPE; policy "FeePolicyVersion"%ROWTYPE; rule "FeeRule"%ROWTYPE; aggregate_fee BIGINT;
BEGIN
 SELECT * INTO parent FROM "Order" WHERE "id" = NEW."orderId";
 SELECT * INTO policy FROM "FeePolicyVersion" WHERE "id" = NEW."feePolicyVersionId";
 SELECT * INTO rule FROM "FeeRule" WHERE "id" = NEW."feeRuleId" AND "policyVersionId" = NEW."feePolicyVersionId";
 IF parent."feeSnapshotVersion" NOT IN (1,2)
 OR (parent."feeSnapshotVersion" = 1 AND NEW."componentKind" <> 'LISTING_TIER')
 OR parent."feePolicyVersionId" IS DISTINCT FROM NEW."feePolicyVersionId"
 OR parent."pricingPolicyVersion" IS DISTINCT FROM NEW."pricingPolicyVersion"
 OR parent."subtotalAmountMinor" IS DISTINCT FROM NEW."baseAmountMinor"
 OR parent."totalAmountMinor" IS DISTINCT FROM parent."subtotalAmountMinor"
 OR parent."currency" IS DISTINCT FROM NEW."currency"
 OR policy."publicVersion" IS DISTINCT FROM NEW."pricingPolicyVersion"
 OR rule."category" IS DISTINCT FROM NEW."category" OR rule."partyCharged" IS DISTINCT FROM NEW."partyCharged"
 OR rule."formula" IS DISTINCT FROM NEW."formula" OR rule."percentBps" IS DISTINCT FROM NEW."percentBps"
 OR rule."enabled" IS DISTINCT FROM TRUE OR NEW."partyCharged" <> 'SELLER' OR NEW."formula" <> 'PERCENT_BPS'
 OR NEW."percentBps" < 0 OR NEW."baseAmountMinor" < 0 OR NEW."feeAmountMinor" < 0
 OR NEW."pricingPolicyVersion" <= 0 OR NEW."currency" <> 'BRL'
 OR rule."fixedAmountMinor" IS NOT NULL OR rule."minimumAmountMinor" IS NOT NULL OR rule."maximumAmountMinor" IS NOT NULL
 OR rule."paymentMethod" IS NOT NULL OR rule."installmentsFrom" IS NOT NULL OR rule."installmentsTo" IS NOT NULL
 OR rule."sellerLevel" IS NOT NULL OR rule."withdrawalSpeed" IS NOT NULL OR rule."productType" IS NOT NULL
 OR (NEW."componentKind" = 'LISTING_TIER' AND (parent."platformCommissionRuleId" IS DISTINCT FROM NEW."feeRuleId" OR rule."promotionTier" IS DISTINCT FROM NEW."listingTier"::text OR rule."sellerPlan" IS NOT NULL))
 OR (NEW."componentKind" = 'SELLER_MAX' AND (parent."feeSnapshotVersion" <> 2 OR parent."sellerPlanSnapshot" <> 'LIT_MAX' OR rule."sellerPlan" IS DISTINCT FROM 'LIT_MAX' OR rule."promotionTier" IS NOT NULL))
 OR NEW."feeAmountMinor" IS DISTINCT FROM ((NEW."baseAmountMinor" * NEW."percentBps") / 10000)
 THEN RAISE EXCEPTION 'ORDER_FEE_COMPONENT_SNAPSHOT_INCONSISTENT' USING ERRCODE = '23514'; END IF;
 RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER "Order_h2_listing_tier_component_required" ON "Order";
DROP FUNCTION require_h2_listing_tier_component();
CREATE FUNCTION require_order_fee_components() RETURNS TRIGGER AS $$
DECLARE tier_count INTEGER; max_count INTEGER; aggregate_fee BIGINT;
BEGIN
 IF NEW."feeSnapshotVersion" IN (1,2) THEN
  SELECT count(*) FILTER (WHERE "componentKind"='LISTING_TIER'), count(*) FILTER (WHERE "componentKind"='SELLER_MAX'), COALESCE(sum("feeAmountMinor"),0)
  INTO tier_count,max_count,aggregate_fee FROM "OrderFeeComponentSnapshot" WHERE "orderId"=NEW."id";
  IF tier_count <> 1 OR (NEW."feeSnapshotVersion"=1 AND max_count<>0)
    OR (NEW."feeSnapshotVersion"=2 AND NEW."commercialSnapshotVersion"<>1)
    OR (NEW."feeSnapshotVersion"=2 AND (NEW."sellerPlanSnapshot" IS NULL OR NEW."sellerPlanSnapshot" NOT IN ('STANDARD','LIT_MAX')))
    OR (NEW."feeSnapshotVersion"=2 AND NEW."sellerPlanSnapshot"='STANDARD' AND max_count<>0)
    OR (NEW."feeSnapshotVersion"=2 AND NEW."sellerPlanSnapshot"='LIT_MAX' AND max_count<>1)
    OR aggregate_fee IS DISTINCT FROM NEW."platformFeeAmountMinor"
  THEN RAISE EXCEPTION 'ORDER_FEE_COMPONENTS_INCOMPLETE' USING ERRCODE='23514'; END IF;
 END IF; RETURN NULL;
END; $$ LANGUAGE plpgsql;
CREATE CONSTRAINT TRIGGER "Order_fee_components_required" AFTER INSERT ON "Order" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION require_order_fee_components();
