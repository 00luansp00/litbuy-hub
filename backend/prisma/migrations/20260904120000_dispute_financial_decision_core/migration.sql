CREATE TYPE "DisputeFinancialDecisionType" AS ENUM ('TOTAL', 'PARTIAL');

CREATE TABLE "DisputeFinancialDecision" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "disputeCaseId" UUID NOT NULL,
  "orderId" UUID NOT NULL,
  "buyerUserId" UUID NOT NULL,
  "sellerProfileId" UUID NOT NULL,
  "decisionType" "DisputeFinancialDecisionType" NOT NULL,
  "orderPrincipalSnapshotMinor" BIGINT NOT NULL,
  "decidedPrincipalAmountMinor" BIGINT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'BRL',
  "executableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdByUserId" UUID NOT NULL,
  "idempotencyKeyHash" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DisputeFinancialDecision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DisputeFinancialDecision_disputeCaseId_key" UNIQUE ("disputeCaseId"),
  CONSTRAINT "DisputeFinancialDecision_disputeCaseId_orderId_key" UNIQUE ("disputeCaseId", "orderId"),
  CONSTRAINT "DisputeFinancialDecision_creator_key_key" UNIQUE ("createdByUserId", "idempotencyKeyHash"),
  CONSTRAINT "DisputeFinancialDecision_case_order_fkey" FOREIGN KEY ("disputeCaseId", "orderId") REFERENCES "DisputeCase"("id", "orderId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "DisputeFinancialDecision_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "DisputeFinancialDecision_buyerUserId_fkey" FOREIGN KEY ("buyerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "DisputeFinancialDecision_sellerProfileId_fkey" FOREIGN KEY ("sellerProfileId") REFERENCES "SellerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "DisputeFinancialDecision_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "DisputeFinancialDecision_currency_check" CHECK ("currency" = 'BRL'),
  CONSTRAINT "DisputeFinancialDecision_hashes_check" CHECK ("idempotencyKeyHash" ~ '^[0-9a-f]{64}$' AND "requestHash" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "DisputeFinancialDecision_amount_shape_check" CHECK (
    "orderPrincipalSnapshotMinor" > 0 AND
    (("decisionType" = 'TOTAL' AND "decidedPrincipalAmountMinor" = "orderPrincipalSnapshotMinor") OR
     ("decisionType" = 'PARTIAL' AND "decidedPrincipalAmountMinor" > 0 AND "decidedPrincipalAmountMinor" < "orderPrincipalSnapshotMinor"))
  )
);

CREATE INDEX "DisputeFinancialDecision_sellerProfileId_executableAt_id_idx" ON "DisputeFinancialDecision"("sellerProfileId", "executableAt", "id");
CREATE INDEX "DisputeFinancialDecision_orderId_executableAt_id_idx" ON "DisputeFinancialDecision"("orderId", "executableAt", "id");

CREATE FUNCTION "guard_dispute_financial_decision_insert"() RETURNS trigger AS $$
DECLARE
  dispute_row "DisputeCase"%ROWTYPE;
  order_row "Order"%ROWTYPE;
  already_decided BIGINT;
BEGIN
  -- The Order row is the common boundary for service and direct SQL inserts.
  SELECT * INTO order_row FROM "Order" WHERE id = NEW."orderId" FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'financial decision order not found' USING ERRCODE = '23503'; END IF;
  SELECT * INTO dispute_row FROM "DisputeCase" WHERE id = NEW."disputeCaseId" FOR SHARE;
  IF NOT FOUND OR dispute_row."orderId" <> NEW."orderId" OR dispute_row.status <> 'RESOLVED_BUYER' OR dispute_row."terminalAt" IS NULL THEN
    RAISE EXCEPTION 'financial decision requires terminal RESOLVED_BUYER case' USING ERRCODE = '23514';
  END IF;
  IF NEW."buyerUserId" <> order_row."buyerUserId" OR NEW."sellerProfileId" <> order_row."sellerProfileId" THEN
    RAISE EXCEPTION 'financial decision parties must match order' USING ERRCODE = '23514';
  END IF;
  IF NEW."orderPrincipalSnapshotMinor" <> order_row."subtotalAmountMinor" - order_row."discountAmountMinor" THEN
    RAISE EXCEPTION 'financial decision principal snapshot mismatch' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM "UserRoleAssignment" WHERE "userId" = NEW."createdByUserId" AND role = 'ADMIN') THEN
    RAISE EXCEPTION 'financial decision creator must be ADMIN' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "FinancialHold" h JOIN "LedgerTransaction" lt ON lt.id = h."releaseLedgerTransactionId"
    WHERE h."orderId" = NEW."orderId" AND h."sellerProfileId" = NEW."sellerProfileId"
      AND h.reason = 'DELIVERY_PROTECTION' AND h.status = 'RELEASED' AND h."amountMinor" > 0
      AND h."releasedAt" IS NOT NULL AND h."releaseLedgerTransactionId" IS NOT NULL
      AND lt.type = 'SELLER_FUNDS_RELEASED' AND lt."referenceType" = 'FinancialHoldRelease'
      AND lt."referenceId" = h.id::text AND lt."createdAt" = h."releasedAt"
  ) THEN RAISE EXCEPTION 'financial decision requires legitimate seller proceeds release' USING ERRCODE = '23514'; END IF;
  SELECT COALESCE(SUM("decidedPrincipalAmountMinor"), 0) INTO already_decided FROM "DisputeFinancialDecision" WHERE "orderId" = NEW."orderId";
  IF already_decided + NEW."decidedPrincipalAmountMinor" > NEW."orderPrincipalSnapshotMinor" THEN
    RAISE EXCEPTION 'financial decision cumulative principal exceeded' USING ERRCODE = '23514';
  END IF;
  NEW."executableAt" := transaction_timestamp()::timestamp(3);
  NEW."createdAt" := NEW."executableAt";
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "reject_dispute_financial_decision_mutation"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'dispute financial decisions are append-only' USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "DisputeFinancialDecision_insert_guard" BEFORE INSERT ON "DisputeFinancialDecision" FOR EACH ROW EXECUTE FUNCTION "guard_dispute_financial_decision_insert"();
CREATE TRIGGER "DisputeFinancialDecision_append_only" BEFORE UPDATE OR DELETE ON "DisputeFinancialDecision" FOR EACH ROW EXECUTE FUNCTION "reject_dispute_financial_decision_mutation"();
