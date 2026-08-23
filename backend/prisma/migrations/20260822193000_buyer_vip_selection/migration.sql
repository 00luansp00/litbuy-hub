CREATE TYPE "BuyerVipPlan" AS ENUM ('NONE', 'BASIC', 'PREMIUM');

-- NULL/NULL remains the truthful shape for Orders created before Q1.
ALTER TABLE "Order"
  ADD COLUMN "buyerVipSelectionVersion" INTEGER,
  ADD COLUMN "buyerVipPlanSnapshot" "BuyerVipPlan",
  ADD CONSTRAINT "Order_buyer_vip_selection_shape_check" CHECK (
    ("buyerVipSelectionVersion" IS NULL AND "buyerVipPlanSnapshot" IS NULL)
    OR ("buyerVipSelectionVersion" = 1 AND "buyerVipPlanSnapshot" IS NOT NULL)
  );

CREATE FUNCTION prevent_order_buyer_vip_selection_update() RETURNS TRIGGER AS $$
BEGIN
  IF OLD."buyerVipSelectionVersion" IS DISTINCT FROM NEW."buyerVipSelectionVersion"
  OR OLD."buyerVipPlanSnapshot" IS DISTINCT FROM NEW."buyerVipPlanSnapshot"
  THEN
    RAISE EXCEPTION 'ORDER_BUYER_VIP_SELECTION_IMMUTABLE' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Order_buyer_vip_selection_immutable"
BEFORE UPDATE OF "buyerVipSelectionVersion", "buyerVipPlanSnapshot" ON "Order"
FOR EACH ROW EXECUTE FUNCTION prevent_order_buyer_vip_selection_update();
