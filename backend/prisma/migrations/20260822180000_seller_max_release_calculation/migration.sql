ALTER TABLE "Order"
  ADD COLUMN "sellerMaxReleaseCalculationVersion" INTEGER,
  ADD COLUMN "sellerMaxReleaseReductionHours" INTEGER,
  ADD COLUMN "sellerMaxReleaseTargetAt" TIMESTAMP(3),
  ADD COLUMN "sellerMaxEffectiveReleaseAt" TIMESTAMP(3),
  ADD CONSTRAINT "Order_seller_max_release_shape_check" CHECK (
    ("sellerMaxReleaseCalculationVersion" IS NULL AND "sellerMaxReleaseReductionHours" IS NULL
      AND "sellerMaxReleaseTargetAt" IS NULL AND "sellerMaxEffectiveReleaseAt" IS NULL)
    OR ("sellerMaxReleaseCalculationVersion" = 1 AND "sellerPlanSnapshot" = 'LIT_MAX'
      AND "sellerMaxQualificationVersion" = 1 AND "sellerMaxReleaseReductionHours" >= 0
      AND mod("sellerMaxReleaseReductionHours", 48) = 0 AND "sellerMaxReleaseTargetAt" IS NOT NULL
      AND (("sellerMaxQualificationStatus" = 'PENDING' AND "sellerMaxEffectiveReleaseAt" IS NULL)
        OR ("sellerMaxQualificationStatus" IN ('QUALIFIED','EXPIRED') AND "sellerMaxEffectiveReleaseAt" IS NOT NULL)))) NOT VALID;

CREATE FUNCTION enforce_seller_max_release_invariants() RETURNS trigger AS $$
DECLARE delivered_at timestamp(3); base_at timestamp(3); expected_reduction integer;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD."sellerMaxReleaseCalculationVersion" IS NOT NULL THEN
    IF NEW."sellerMaxReleaseCalculationVersion" IS DISTINCT FROM OLD."sellerMaxReleaseCalculationVersion"
      OR NEW."sellerMaxReleaseReductionHours" IS DISTINCT FROM OLD."sellerMaxReleaseReductionHours"
      OR NEW."sellerMaxReleaseTargetAt" IS DISTINCT FROM OLD."sellerMaxReleaseTargetAt"
      OR (OLD."sellerMaxEffectiveReleaseAt" IS NOT NULL AND NEW."sellerMaxEffectiveReleaseAt" IS DISTINCT FROM OLD."sellerMaxEffectiveReleaseAt") THEN
      RAISE EXCEPTION 'seller MAX release snapshot is immutable' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF NEW."sellerMaxReleaseCalculationVersion" = 1 THEN
    SELECT "createdAt" INTO delivered_at FROM "OrderDelivery" WHERE "orderId" = NEW."id";
    IF delivered_at IS NULL OR NEW."frozenBaseReleaseDelayHours" IS NULL THEN
      RAISE EXCEPTION 'seller MAX release requires delivery and frozen delay' USING ERRCODE = '23514';
    END IF;
    expected_reduction := floor(NEW."frozenBaseReleaseDelayHours"::numeric / 168)::integer * 48;
    base_at := (delivered_at + make_interval(hours => NEW."frozenBaseReleaseDelayHours"))::timestamp(3);
    IF NEW."sellerMaxReleaseReductionHours" <> expected_reduction
      OR NEW."sellerMaxReleaseReductionHours" > NEW."frozenBaseReleaseDelayHours"
      OR NEW."sellerMaxReleaseTargetAt" IS DISTINCT FROM
        (delivered_at + make_interval(hours => NEW."frozenBaseReleaseDelayHours" - expected_reduction))::timestamp(3)
      OR NEW."sellerMaxReleaseTargetAt" > base_at
      OR NEW."sellerMaxEffectiveReleaseAt" > base_at THEN
      RAISE EXCEPTION 'seller MAX release derivation is invalid' USING ERRCODE = '23514';
    END IF;
    IF NEW."sellerMaxQualificationStatus" = 'QUALIFIED' AND
      NEW."sellerMaxEffectiveReleaseAt" IS DISTINCT FROM LEAST(base_at, GREATEST(NEW."sellerMaxReleaseTargetAt", NEW."buyerConfirmedAt")) THEN
      RAISE EXCEPTION 'seller MAX qualified effective deadline is invalid' USING ERRCODE = '23514';
    ELSIF NEW."sellerMaxQualificationStatus" = 'EXPIRED' AND NEW."sellerMaxEffectiveReleaseAt" IS DISTINCT FROM base_at THEN
      RAISE EXCEPTION 'seller MAX expired effective deadline is invalid' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "Order_seller_max_release_invariants" BEFORE INSERT OR UPDATE OF
  "sellerMaxReleaseCalculationVersion", "sellerMaxReleaseReductionHours", "sellerMaxReleaseTargetAt",
  "sellerMaxEffectiveReleaseAt", "sellerMaxQualificationStatus", "sellerMaxQualificationDecidedAt", "buyerConfirmedAt"
ON "Order" FOR EACH ROW EXECUTE FUNCTION enforce_seller_max_release_invariants();
ALTER TABLE "Order" VALIDATE CONSTRAINT "Order_seller_max_release_shape_check";
