CREATE OR REPLACE FUNCTION enforce_seller_max_qualification_invariants() RETURNS trigger AS $$
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
    IF OLD."sellerMaxQualificationStatus" IN ('QUALIFIED', 'EXPIRED') THEN
      IF NEW."sellerMaxQualificationStatus" IS DISTINCT FROM OLD."sellerMaxQualificationStatus" THEN
        RAISE EXCEPTION 'seller MAX terminal qualification is immutable' USING ERRCODE = '23514';
      END IF;
      IF NEW."sellerMaxQualificationDecidedAt" IS DISTINCT FROM OLD."sellerMaxQualificationDecidedAt" THEN
        RAISE EXCEPTION 'seller MAX terminal decision timestamp is immutable' USING ERRCODE = '23514';
      END IF;
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
