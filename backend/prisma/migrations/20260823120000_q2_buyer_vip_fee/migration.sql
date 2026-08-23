-- Q2 is prospective: no Order backfill and no production FeePolicy seed.
ALTER TABLE "FeeRule" ADD COLUMN "buyerVipPlan" "BuyerVipPlan";
ALTER TABLE "OrderFeeComponentSnapshot" ADD COLUMN "buyerVipPlan" "BuyerVipPlan";

ALTER TABLE "Order" DROP CONSTRAINT "Order_feeSnapshotVersion_check";
ALTER TABLE "Order" ADD CONSTRAINT "Order_feeSnapshotVersion_check"
  CHECK ("feeSnapshotVersion" IS NULL OR "feeSnapshotVersion" IN (1,2,3));

ALTER TABLE "OrderFeeComponentSnapshot" DROP CONSTRAINT "OrderFeeComponentSnapshot_component_shape_check";
ALTER TABLE "OrderFeeComponentSnapshot" ADD CONSTRAINT "OrderFeeComponentSnapshot_component_shape_check" CHECK (
 ("componentKind" = 'LISTING_TIER' AND "listingTier" IS NOT NULL AND "sellerPlan" IS NULL AND "buyerVipPlan" IS NULL AND "category" = 'PLATFORM_COMMISSION') OR
 ("componentKind" = 'SELLER_MAX' AND "listingTier" IS NULL AND "sellerPlan" = 'LIT_MAX' AND "buyerVipPlan" IS NULL AND "category" = 'LIT_MAX_PRICE') OR
 ("componentKind" = 'BUYER_VIP' AND "listingTier" IS NULL AND "sellerPlan" IS NULL AND "buyerVipPlan" IN ('BASIC','PREMIUM') AND "category" = 'BUYER_SERVICE_FEE')
) NOT VALID;
ALTER TABLE "OrderFeeComponentSnapshot" VALIDATE CONSTRAINT "OrderFeeComponentSnapshot_component_shape_check";

CREATE OR REPLACE FUNCTION validate_order_fee_component_snapshot() RETURNS TRIGGER AS $$
DECLARE parent "Order"%ROWTYPE; policy "FeePolicyVersion"%ROWTYPE; rule "FeeRule"%ROWTYPE;
BEGIN
 SELECT * INTO parent FROM "Order" WHERE "id" = NEW."orderId";
 SELECT * INTO policy FROM "FeePolicyVersion" WHERE "id" = NEW."feePolicyVersionId";
 SELECT * INTO rule FROM "FeeRule" WHERE "id" = NEW."feeRuleId" AND "policyVersionId" = NEW."feePolicyVersionId";
 IF parent."feeSnapshotVersion" NOT IN (1,2,3)
 OR (parent."feeSnapshotVersion" = 1 AND NEW."componentKind" <> 'LISTING_TIER')
 OR (parent."feeSnapshotVersion" = 2 AND NEW."componentKind" = 'BUYER_VIP')
 OR parent."feePolicyVersionId" IS DISTINCT FROM NEW."feePolicyVersionId"
 OR parent."pricingPolicyVersion" IS DISTINCT FROM NEW."pricingPolicyVersion"
 OR parent."subtotalAmountMinor" - parent."discountAmountMinor" IS DISTINCT FROM NEW."baseAmountMinor"
 OR (parent."feeSnapshotVersion" IN (1,2) AND parent."totalAmountMinor" IS DISTINCT FROM parent."subtotalAmountMinor")
 OR parent."currency" IS DISTINCT FROM NEW."currency"
 OR policy."publicVersion" IS DISTINCT FROM NEW."pricingPolicyVersion"
 OR rule."category" IS DISTINCT FROM NEW."category" OR rule."partyCharged" IS DISTINCT FROM NEW."partyCharged"
 OR rule."formula" IS DISTINCT FROM NEW."formula" OR rule."percentBps" IS DISTINCT FROM NEW."percentBps"
 OR rule."enabled" IS DISTINCT FROM TRUE OR NEW."formula" <> 'PERCENT_BPS'
 OR NEW."percentBps" < 0 OR NEW."baseAmountMinor" < 0 OR NEW."feeAmountMinor" < 0
 OR NEW."pricingPolicyVersion" <= 0 OR NEW."currency" <> 'BRL'
 OR rule."fixedAmountMinor" IS NOT NULL OR rule."minimumAmountMinor" IS NOT NULL OR rule."maximumAmountMinor" IS NOT NULL
 OR rule."paymentMethod" IS NOT NULL OR rule."installmentsFrom" IS NOT NULL OR rule."installmentsTo" IS NOT NULL
 OR rule."sellerLevel" IS NOT NULL OR rule."withdrawalSpeed" IS NOT NULL OR rule."productType" IS NOT NULL
 OR (NEW."componentKind" = 'LISTING_TIER' AND (NEW."partyCharged" <> 'SELLER' OR parent."platformCommissionRuleId" IS DISTINCT FROM NEW."feeRuleId" OR rule."promotionTier" IS DISTINCT FROM NEW."listingTier"::text OR rule."sellerPlan" IS NOT NULL OR rule."buyerVipPlan" IS NOT NULL))
 OR (NEW."componentKind" = 'SELLER_MAX' AND (NEW."partyCharged" <> 'SELLER' OR parent."feeSnapshotVersion" NOT IN (2,3) OR parent."sellerPlanSnapshot" <> 'LIT_MAX' OR rule."sellerPlan" IS DISTINCT FROM 'LIT_MAX' OR rule."promotionTier" IS NOT NULL OR rule."buyerVipPlan" IS NOT NULL))
 OR (NEW."componentKind" = 'BUYER_VIP' AND (NEW."partyCharged" <> 'BUYER' OR parent."feeSnapshotVersion" <> 3 OR parent."buyerVipSelectionVersion" <> 1 OR parent."buyerVipPlanSnapshot" IS DISTINCT FROM NEW."buyerVipPlan" OR rule."buyerVipPlan" IS DISTINCT FROM NEW."buyerVipPlan" OR rule."sellerPlan" IS NOT NULL OR rule."promotionTier" IS NOT NULL))
 OR NEW."feeAmountMinor" IS DISTINCT FROM ((NEW."baseAmountMinor" * NEW."percentBps") / 10000)
 THEN RAISE EXCEPTION 'ORDER_FEE_COMPONENT_SNAPSHOT_INCONSISTENT' USING ERRCODE = '23514'; END IF;
 RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION require_order_fee_components() RETURNS TRIGGER AS $$
DECLARE tier_count INTEGER; max_count INTEGER; vip_count INTEGER; aggregate_fee BIGINT; vip_fee BIGINT;
BEGIN
 IF NEW."feeSnapshotVersion" IN (1,2,3) THEN
  SELECT count(*) FILTER (WHERE "componentKind"='LISTING_TIER'),
         count(*) FILTER (WHERE "componentKind"='SELLER_MAX'),
         count(*) FILTER (WHERE "componentKind"='BUYER_VIP'),
         COALESCE(sum("feeAmountMinor"),0),
         COALESCE(sum("feeAmountMinor") FILTER (WHERE "componentKind"='BUYER_VIP'),0)
  INTO tier_count,max_count,vip_count,aggregate_fee,vip_fee
  FROM "OrderFeeComponentSnapshot" WHERE "orderId"=NEW."id";
  IF tier_count <> 1
    OR (NEW."feeSnapshotVersion"=1 AND (max_count<>0 OR vip_count<>0))
    OR (NEW."feeSnapshotVersion"=2 AND vip_count<>0)
    OR (NEW."feeSnapshotVersion" IN (2,3) AND NEW."commercialSnapshotVersion"<>1)
    OR (NEW."feeSnapshotVersion" IN (2,3) AND (NEW."sellerPlanSnapshot" IS NULL OR NEW."sellerPlanSnapshot" NOT IN ('STANDARD','LIT_MAX')))
    OR (NEW."feeSnapshotVersion" IN (2,3) AND NEW."sellerPlanSnapshot"='STANDARD' AND max_count<>0)
    OR (NEW."feeSnapshotVersion" IN (2,3) AND NEW."sellerPlanSnapshot"='LIT_MAX' AND max_count<>1)
    OR (NEW."feeSnapshotVersion"=3 AND (NEW."buyerVipSelectionVersion"<>1 OR NEW."buyerVipPlanSnapshot" IS NULL))
    OR (NEW."feeSnapshotVersion"=3 AND NEW."buyerVipPlanSnapshot"='NONE' AND vip_count<>0)
    OR (NEW."feeSnapshotVersion"=3 AND NEW."buyerVipPlanSnapshot" IN ('BASIC','PREMIUM') AND vip_count<>1)
    OR (NEW."feeSnapshotVersion"=3 AND NEW."totalAmountMinor" IS DISTINCT FROM (NEW."subtotalAmountMinor"-NEW."discountAmountMinor"+vip_fee))
    OR aggregate_fee IS DISTINCT FROM NEW."platformFeeAmountMinor"
  THEN RAISE EXCEPTION 'ORDER_FEE_COMPONENTS_INCOMPLETE' USING ERRCODE='23514'; END IF;
 END IF; RETURN NULL;
END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION prevent_order_pricing_snapshot_update() RETURNS TRIGGER AS $$
BEGIN
 IF OLD."feePolicyVersionId" IS DISTINCT FROM NEW."feePolicyVersionId"
 OR OLD."platformCommissionRuleId" IS DISTINCT FROM NEW."platformCommissionRuleId"
 OR OLD."pricingPolicyVersion" IS DISTINCT FROM NEW."pricingPolicyVersion"
 OR OLD."platformFeeAmountMinor" IS DISTINCT FROM NEW."platformFeeAmountMinor"
 OR OLD."feeSnapshotVersion" IS DISTINCT FROM NEW."feeSnapshotVersion"
 OR OLD."subtotalAmountMinor" IS DISTINCT FROM NEW."subtotalAmountMinor"
 OR OLD."discountAmountMinor" IS DISTINCT FROM NEW."discountAmountMinor"
 OR OLD."totalAmountMinor" IS DISTINCT FROM NEW."totalAmountMinor"
 THEN RAISE EXCEPTION 'ORDER_PRICING_SNAPSHOT_IMMUTABLE' USING ERRCODE = '55000'; END IF;
 RETURN NEW;
END; $$ LANGUAGE plpgsql;

ALTER TABLE "Order" DROP CONSTRAINT "Order_total_check";
ALTER TABLE "Order" ADD CONSTRAINT "Order_total_check" CHECK (
  ("feeSnapshotVersion" IS DISTINCT FROM 3 AND "totalAmountMinor" = "subtotalAmountMinor" - "discountAmountMinor")
  OR ("feeSnapshotVersion" = 3 AND "totalAmountMinor" >= "subtotalAmountMinor" - "discountAmountMinor")
);
ALTER TABLE "Order" DROP CONSTRAINT "Order_platformFeeAmountMinor_lte_subtotal_check";
ALTER TABLE "Order" ADD CONSTRAINT "Order_platformFeeAmountMinor_bounded_check" CHECK (
  ("feeSnapshotVersion" IS DISTINCT FROM 3 AND "platformFeeAmountMinor" <= "subtotalAmountMinor")
  OR ("feeSnapshotVersion" = 3 AND "platformFeeAmountMinor" <= "totalAmountMinor")
);
