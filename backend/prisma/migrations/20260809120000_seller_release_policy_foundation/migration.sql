CREATE TYPE "SellerReleasePolicyStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'ACTIVE', 'RETIRED');

CREATE TABLE "SellerReleasePolicyVersion" (
  "id" UUID NOT NULL,
  "publicVersion" INTEGER NOT NULL,
  "status" "SellerReleasePolicyStatus" NOT NULL DEFAULT 'DRAFT',
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "effectiveTo" TIMESTAMP(3),
  "createdByUserId" UUID NOT NULL,
  "publishedByUserId" UUID,
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SellerReleasePolicyVersion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SellerReleasePolicyVersion_effective_window" CHECK ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom")
);

CREATE TABLE "SellerReleasePolicyRule" (
  "id" UUID NOT NULL,
  "policyVersionId" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "delayHours" INTEGER NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SellerReleasePolicyRule_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SellerReleasePolicyRule_delay_nonnegative" CHECK ("delayHours" >= 0),
  CONSTRAINT "SellerReleasePolicyRule_code_present" CHECK (length(btrim("code")) > 0)
);

CREATE UNIQUE INDEX "SellerReleasePolicyVersion_publicVersion_key" ON "SellerReleasePolicyVersion"("publicVersion");
CREATE UNIQUE INDEX "SellerReleasePolicyRule_policyVersionId_code_key" ON "SellerReleasePolicyRule"("policyVersionId", "code");
ALTER TABLE "SellerReleasePolicyVersion" ADD CONSTRAINT "SellerReleasePolicyVersion_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SellerReleasePolicyVersion" ADD CONSTRAINT "SellerReleasePolicyVersion_publishedByUserId_fkey" FOREIGN KEY ("publishedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SellerReleasePolicyRule" ADD CONSTRAINT "SellerReleasePolicyRule_policyVersionId_fkey" FOREIGN KEY ("policyVersionId") REFERENCES "SellerReleasePolicyVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION seller_release_policy_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE allowed boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'PUBLISHED_POLICY_IMMUTABLE' USING ERRCODE = '55000';
  END IF;
  allowed := (OLD.status = 'DRAFT' AND NEW.status IN ('DRAFT','SCHEDULED','ACTIVE','RETIRED')) OR
             (OLD.status = 'SCHEDULED' AND NEW.status IN ('SCHEDULED','ACTIVE','RETIRED')) OR
             (OLD.status = 'ACTIVE' AND NEW.status IN ('ACTIVE','RETIRED')) OR
             (OLD.status = 'RETIRED' AND NEW.status = 'RETIRED');
  IF NOT allowed THEN RAISE EXCEPTION 'INVALID_POLICY_TRANSITION' USING ERRCODE = '23514'; END IF;
  IF OLD.status <> 'DRAFT' AND (
    NEW."publicVersion" IS DISTINCT FROM OLD."publicVersion" OR
    NEW."effectiveFrom" IS DISTINCT FROM OLD."effectiveFrom" OR
    NEW."effectiveTo" IS DISTINCT FROM OLD."effectiveTo" OR
    NEW."createdByUserId" IS DISTINCT FROM OLD."createdByUserId" OR
    NEW."createdAt" IS DISTINCT FROM OLD."createdAt" OR
    NEW."publishedByUserId" IS DISTINCT FROM OLD."publishedByUserId" OR
    NEW."publishedAt" IS DISTINCT FROM OLD."publishedAt"
  ) THEN RAISE EXCEPTION 'PUBLISHED_POLICY_IMMUTABLE' USING ERRCODE = '55000'; END IF;
  IF NEW.status <> 'DRAFT' AND (NEW."publishedByUserId" IS NULL OR NEW."publishedAt" IS NULL) THEN
    RAISE EXCEPTION 'POLICY_PUBLICATION_AUDIT_REQUIRED' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER seller_release_policy_immutable BEFORE UPDATE OR DELETE ON "SellerReleasePolicyVersion" FOR EACH ROW EXECUTE FUNCTION seller_release_policy_guard();

CREATE FUNCTION seller_release_policy_rule_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE policy_status text; parent_id uuid;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW."policyVersionId" IS DISTINCT FROM OLD."policyVersionId" THEN
    RAISE EXCEPTION 'POLICY_RULE_PARENT_IMMUTABLE' USING ERRCODE = '55000';
  END IF;
  parent_id := CASE WHEN TG_OP = 'DELETE' THEN OLD."policyVersionId" ELSE NEW."policyVersionId" END;
  SELECT status::text INTO policy_status FROM "SellerReleasePolicyVersion" WHERE id = parent_id;
  IF policy_status IS DISTINCT FROM 'DRAFT' THEN
    RAISE EXCEPTION 'PUBLISHED_POLICY_IMMUTABLE' USING ERRCODE = '55000';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER seller_release_policy_rule_immutable BEFORE INSERT OR UPDATE OR DELETE ON "SellerReleasePolicyRule" FOR EACH ROW EXECUTE FUNCTION seller_release_policy_rule_guard();

CREATE FUNCTION seller_release_policy_no_overlap() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status::text NOT IN ('ACTIVE', 'SCHEDULED') THEN RETURN NEW; END IF;
  -- Serializes publication attempts; unlike an ordinary lookup trigger this closes the race.
  PERFORM pg_advisory_xact_lock(hashtext('seller-release-policy-effective-window'));
  IF EXISTS (
    SELECT 1 FROM "SellerReleasePolicyVersion" p
    WHERE p.id <> NEW.id AND p.status::text IN ('ACTIVE', 'SCHEDULED')
      AND tstzrange(p."effectiveFrom", p."effectiveTo", '[)') && tstzrange(NEW."effectiveFrom", NEW."effectiveTo", '[)')
  ) THEN RAISE EXCEPTION 'POLICY_EFFECTIVE_PERIOD_CONFLICT' USING ERRCODE = '23P01'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER seller_release_policy_no_overlap BEFORE INSERT OR UPDATE ON "SellerReleasePolicyVersion" FOR EACH ROW EXECUTE FUNCTION seller_release_policy_no_overlap();
