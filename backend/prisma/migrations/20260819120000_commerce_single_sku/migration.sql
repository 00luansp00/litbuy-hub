-- COMMERCE-1SKU is fail-closed: incompatible legacy data must be reconciled by
-- a separately authorized process before this migration can be applied.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "CartItem" GROUP BY "cartId" HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'COMMERCE_1SKU_LEGACY_CART_ITEMS_REQUIRE_RECONCILIATION';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "OrderItem" GROUP BY "orderId" HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'COMMERCE_1SKU_LEGACY_ORDER_ITEMS_REQUIRE_RECONCILIATION';
  END IF;
END $$;

DROP INDEX "CartItem_cartId_idx";
DROP INDEX "OrderItem_orderId_idx";

CREATE UNIQUE INDEX "CartItem_cartId_key" ON "CartItem"("cartId");
CREATE UNIQUE INDEX "OrderItem_orderId_key" ON "OrderItem"("orderId");
