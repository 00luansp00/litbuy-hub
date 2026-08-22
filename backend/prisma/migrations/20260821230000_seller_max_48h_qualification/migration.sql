CREATE TYPE "SellerMaxQualificationStatus" AS ENUM ('PENDING', 'QUALIFIED', 'EXPIRED');

ALTER TYPE "OrderEventType" ADD VALUE 'SELLER_MAX_QUALIFICATION_STARTED';
ALTER TYPE "OrderEventType" ADD VALUE 'SELLER_MAX_QUALIFIED';
ALTER TYPE "OrderEventType" ADD VALUE 'SELLER_MAX_QUALIFICATION_EXPIRED';

ALTER TABLE "Order"
  ADD COLUMN "sellerMaxQualificationVersion" INTEGER,
  ADD COLUMN "sellerMaxQualificationStatus" "SellerMaxQualificationStatus",
  ADD COLUMN "sellerMaxQualificationDeadlineAt" TIMESTAMP(3),
  ADD COLUMN "sellerMaxQualificationDecidedAt" TIMESTAMP(3),
  ADD COLUMN "buyerConfirmedAt" TIMESTAMP(3),
  ADD CONSTRAINT "Order_seller_max_qualification_shape_check" CHECK (
    ("sellerMaxQualificationVersion" IS NULL
      AND "sellerMaxQualificationStatus" IS NULL
      AND "sellerMaxQualificationDeadlineAt" IS NULL
      AND "sellerMaxQualificationDecidedAt" IS NULL)
    OR
    ("sellerPlanSnapshot" = 'LIT_MAX'
      AND "sellerMaxQualificationVersion" = 1
      AND "sellerMaxQualificationStatus" IS NOT NULL
      AND "sellerMaxQualificationDeadlineAt" IS NOT NULL
      AND (
        ("sellerMaxQualificationStatus" = 'PENDING'
          AND "sellerMaxQualificationDecidedAt" IS NULL
          AND "buyerConfirmedAt" IS NULL)
        OR
        ("sellerMaxQualificationStatus" = 'QUALIFIED'
          AND "sellerMaxQualificationDecidedAt" IS NOT NULL
          AND "buyerConfirmedAt" IS NOT NULL
          AND "buyerConfirmedAt" <= "sellerMaxQualificationDeadlineAt")
        OR
        ("sellerMaxQualificationStatus" = 'EXPIRED'
          AND "sellerMaxQualificationDecidedAt" IS NOT NULL
          AND ("buyerConfirmedAt" IS NULL
            OR "buyerConfirmedAt" > "sellerMaxQualificationDeadlineAt"))
      ))
  );

CREATE INDEX "Order_sellerMaxQualificationStatus_sellerMaxQualificationDeadlineAt_idx"
  ON "Order"("sellerMaxQualificationStatus", "sellerMaxQualificationDeadlineAt");

CREATE FUNCTION enforce_seller_max_qualification_invariants() RETURNS trigger AS $$
DECLARE delivered_at timestamp(3);
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD."sellerMaxQualificationVersion" IS NOT NULL
       AND NEW."sellerMaxQualificationVersion" IS DISTINCT FROM OLD."sellerMaxQualificationVersion" THEN
      RAISE EXCEPTION 'seller MAX qualification version is immutable' USING ERRCODE = '23514';
    END IF;
    IF OLD."sellerMaxQualificationDeadlineAt" IS NOT NULL
       AND NEW."sellerMaxQualificationDeadlineAt" IS DISTINCT FROM OLD."sellerMaxQualificationDeadlineAt" THEN
      RAISE EXCEPTION 'seller MAX qualification deadline is immutable' USING ERRCODE = '23514';
    END IF;
    IF OLD."buyerConfirmedAt" IS NOT NULL
       AND NEW."buyerConfirmedAt" IS DISTINCT FROM OLD."buyerConfirmedAt" THEN
      RAISE EXCEPTION 'buyer confirmation timestamp is immutable' USING ERRCODE = '23514';
    END IF;
    IF OLD."sellerMaxQualificationStatus" IN ('QUALIFIED', 'EXPIRED')
       AND NEW."sellerMaxQualificationStatus" IS DISTINCT FROM OLD."sellerMaxQualificationStatus" THEN
      RAISE EXCEPTION 'seller MAX terminal qualification is immutable' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW."sellerMaxQualificationVersion" = 1 THEN
    SELECT "createdAt" INTO delivered_at FROM "OrderDelivery" WHERE "orderId" = NEW."id";
    IF delivered_at IS NULL
       OR NEW."sellerMaxQualificationDeadlineAt" IS DISTINCT FROM delivered_at + interval '48 hours' THEN
      RAISE EXCEPTION 'seller MAX deadline must derive from authoritative delivery timestamp' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Order_seller_max_qualification_invariants"
BEFORE INSERT OR UPDATE OF
  "sellerMaxQualificationVersion", "sellerMaxQualificationStatus",
  "sellerMaxQualificationDeadlineAt", "sellerMaxQualificationDecidedAt", "buyerConfirmedAt"
ON "Order" FOR EACH ROW EXECUTE FUNCTION enforce_seller_max_qualification_invariants();
