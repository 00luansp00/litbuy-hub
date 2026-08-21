-- Products created before I1 cannot evidence MAX, so they are conservatively STANDARD.
ALTER TABLE "Product"
  ADD COLUMN "sellerPlan" "ListingDraftSellerPlanPreference" NOT NULL DEFAULT 'STANDARD';

-- NULL/NULL identifies legacy Orders. New checkout Orders use the versioned v1 snapshot.
ALTER TABLE "Order"
  ADD COLUMN "commercialSnapshotVersion" INTEGER,
  ADD COLUMN "sellerPlanSnapshot" "ListingDraftSellerPlanPreference",
  ADD CONSTRAINT "Order_commercialSellerPlanSnapshot_check" CHECK (
    ("commercialSnapshotVersion" IS NULL AND "sellerPlanSnapshot" IS NULL)
    OR ("commercialSnapshotVersion" = 1 AND "sellerPlanSnapshot" IS NOT NULL)
  );

CREATE FUNCTION prevent_order_commercial_snapshot_update() RETURNS TRIGGER AS $$
BEGIN
  IF OLD."commercialSnapshotVersion" IS DISTINCT FROM NEW."commercialSnapshotVersion"
  OR OLD."sellerPlanSnapshot" IS DISTINCT FROM NEW."sellerPlanSnapshot"
  THEN
    RAISE EXCEPTION 'ORDER_COMMERCIAL_SNAPSHOT_IMMUTABLE' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Order_commercial_snapshot_immutable"
BEFORE UPDATE OF "commercialSnapshotVersion", "sellerPlanSnapshot" ON "Order"
FOR EACH ROW EXECUTE FUNCTION prevent_order_commercial_snapshot_update();
