CREATE TABLE "DisputeSellerLiability" (
 "id" UUID NOT NULL DEFAULT gen_random_uuid(), "disputeFinancialDecisionId" UUID NOT NULL,
 "disputeCaseId" UUID NOT NULL, "orderId" UUID NOT NULL, "buyerUserId" UUID NOT NULL,
 "sellerProfileId" UUID NOT NULL, "decisionPrincipalAmountMinor" BIGINT NOT NULL,
 "reversiblePlatformSellerFeeRequiredAmountMinor" BIGINT NOT NULL, "sellerLiabilityAmountMinor" BIGINT NOT NULL,
 "currency" TEXT NOT NULL DEFAULT 'BRL', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "DisputeSellerLiability_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "DisputeSellerLiability_decision_key" UNIQUE ("disputeFinancialDecisionId"),
 CONSTRAINT "DisputeSellerLiability_case_key" UNIQUE ("disputeCaseId"),
 CONSTRAINT "DisputeSellerLiability_amounts_check" CHECK ("decisionPrincipalAmountMinor">0 AND "reversiblePlatformSellerFeeRequiredAmountMinor">=0 AND "reversiblePlatformSellerFeeRequiredAmountMinor"<="decisionPrincipalAmountMinor" AND "sellerLiabilityAmountMinor"="decisionPrincipalAmountMinor"-"reversiblePlatformSellerFeeRequiredAmountMinor"),
 CONSTRAINT "DisputeSellerLiability_currency_check" CHECK ("currency"='BRL'),
 CONSTRAINT "DisputeSellerLiability_decision_fkey" FOREIGN KEY ("disputeFinancialDecisionId") REFERENCES "DisputeFinancialDecision"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "DisputeSellerLiability_case_fkey" FOREIGN KEY ("disputeCaseId") REFERENCES "DisputeCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "DisputeSellerLiability_order_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "DisputeSellerLiability_buyer_fkey" FOREIGN KEY ("buyerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "DisputeSellerLiability_seller_fkey" FOREIGN KEY ("sellerProfileId") REFERENCES "SellerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "DisputeSellerLiability_order_created_id_idx" ON "DisputeSellerLiability"("orderId","createdAt","id");
CREATE INDEX "DisputeSellerLiability_seller_created_id_idx" ON "DisputeSellerLiability"("sellerProfileId","createdAt","id");

CREATE TABLE "DisputeSellerLiabilityFeeComponent" (
 "id" UUID NOT NULL DEFAULT gen_random_uuid(), "disputeSellerLiabilityId" UUID NOT NULL,
 "orderFeeComponentSnapshotId" UUID NOT NULL, "componentKind" "OrderFeeComponentKind" NOT NULL,
 "originalFrozenFeeAmountMinor" BIGINT NOT NULL, "reversalRequiredAmountMinor" BIGINT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "DisputeSellerLiabilityFeeComponent_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "DisputeSellerLiabilityFeeComponent_unique" UNIQUE ("disputeSellerLiabilityId","orderFeeComponentSnapshotId"),
 CONSTRAINT "DisputeSellerLiabilityFeeComponent_amounts" CHECK ("originalFrozenFeeAmountMinor">=0 AND "reversalRequiredAmountMinor">=0 AND "reversalRequiredAmountMinor"<="originalFrozenFeeAmountMinor"),
 CONSTRAINT "DisputeSellerLiabilityFeeComponent_kind" CHECK ("componentKind" IN ('LISTING_TIER','SELLER_MAX')),
 CONSTRAINT "DisputeSellerLiabilityFeeComponent_liability_fkey" FOREIGN KEY ("disputeSellerLiabilityId") REFERENCES "DisputeSellerLiability"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "DisputeSellerLiabilityFeeComponent_snapshot_fkey" FOREIGN KEY ("orderFeeComponentSnapshotId") REFERENCES "OrderFeeComponentSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE FUNCTION "seller_liability_expected_allocation"(decision_id uuid, fee_amount bigint) RETURNS bigint AS $$
DECLARE d "DisputeFinancialDecision"%ROWTYPE; prior_principal bigint;
BEGIN
 SELECT * INTO d FROM "DisputeFinancialDecision" WHERE id=decision_id;
 SELECT COALESCE(sum(x."decidedPrincipalAmountMinor"),0) INTO prior_principal FROM "DisputeFinancialDecision" x
 WHERE x."orderId"=d."orderId" AND (x."executableAt",x.id) < (d."executableAt",d.id);
 RETURN (fee_amount*(prior_principal+d."decidedPrincipalAmountMinor")/d."orderPrincipalSnapshotMinor")-(fee_amount*prior_principal/d."orderPrincipalSnapshotMinor");
END; $$ LANGUAGE plpgsql STABLE;

CREATE FUNCTION "guard_dispute_seller_liability_insert"() RETURNS trigger AS $$
DECLARE d "DisputeFinancialDecision"%ROWTYPE; o "Order"%ROWTYPE; expected bigint; tier_count int; max_count int; vip_count int;
BEGIN
 SELECT * INTO d FROM "DisputeFinancialDecision" WHERE id=NEW."disputeFinancialDecisionId";
 IF NOT FOUND THEN RAISE EXCEPTION 'seller liability financial decision not found' USING ERRCODE='23503'; END IF;
 SELECT * INTO o FROM "Order" WHERE id=d."orderId" FOR UPDATE;
 IF o."feeSnapshotVersion" IS NULL THEN RAISE EXCEPTION 'SELLER_LIABILITY_LEGACY_FEE_UNRESOLVED' USING ERRCODE='23514'; END IF;
 IF o."feeSnapshotVersion" NOT IN (1,2,3) THEN RAISE EXCEPTION 'seller liability unsupported fee snapshot' USING ERRCODE='23514'; END IF;
 SELECT count(*) FILTER(WHERE "componentKind"='LISTING_TIER'), count(*) FILTER(WHERE "componentKind"='SELLER_MAX'), count(*) FILTER(WHERE "componentKind"='BUYER_VIP') INTO tier_count,max_count,vip_count FROM "OrderFeeComponentSnapshot" WHERE "orderId"=o.id;
 IF tier_count<>1 OR (o."feeSnapshotVersion"=1 AND (max_count<>0 OR vip_count<>0)) OR (o."feeSnapshotVersion"=2 AND vip_count<>0)
 OR (o."feeSnapshotVersion" IN (2,3) AND ((o."sellerPlanSnapshot"='LIT_MAX' AND max_count<>1) OR (o."sellerPlanSnapshot"<>'LIT_MAX' AND max_count<>0)))
 OR (o."feeSnapshotVersion"=3 AND ((o."buyerVipPlanSnapshot" IN ('BASIC','PREMIUM') AND vip_count<>1) OR (o."buyerVipPlanSnapshot"='NONE' AND vip_count<>0))) THEN
  RAISE EXCEPTION 'seller liability incoherent fee snapshot' USING ERRCODE='23514'; END IF;
 IF EXISTS(SELECT 1 FROM "OrderFeeComponentSnapshot" s WHERE s."orderId"=o.id AND s."componentKind" IN ('LISTING_TIER','SELLER_MAX') AND (s."partyCharged"<>'SELLER' OR s.formula<>'PERCENT_BPS' OR s.currency<>d.currency OR s."baseAmountMinor"<>d."orderPrincipalSnapshotMinor" OR s."feeAmountMinor"<0)) THEN RAISE EXCEPTION 'seller liability unauthorized seller fee shape' USING ERRCODE='23514'; END IF;
 SELECT COALESCE(sum("seller_liability_expected_allocation"(d.id,s."feeAmountMinor")),0) INTO expected FROM "OrderFeeComponentSnapshot" s WHERE s."orderId"=o.id AND s."componentKind" IN ('LISTING_TIER','SELLER_MAX');
 IF NEW."disputeCaseId"<>d."disputeCaseId" OR NEW."orderId"<>d."orderId" OR NEW."buyerUserId"<>d."buyerUserId" OR NEW."sellerProfileId"<>d."sellerProfileId" OR NEW.currency<>d.currency OR NEW."decisionPrincipalAmountMinor"<>d."decidedPrincipalAmountMinor" OR NEW."reversiblePlatformSellerFeeRequiredAmountMinor"<>expected OR NEW."sellerLiabilityAmountMinor"<>d."decidedPrincipalAmountMinor"-expected OR expected>d."decidedPrincipalAmountMinor" THEN RAISE EXCEPTION 'seller liability authority mismatch' USING ERRCODE='23514'; END IF;
 NEW."createdAt":=transaction_timestamp()::timestamp(3); RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE FUNCTION "guard_dispute_seller_liability_component_insert"() RETURNS trigger AS $$
DECLARE l "DisputeSellerLiability"%ROWTYPE; s "OrderFeeComponentSnapshot"%ROWTYPE; expected bigint;
BEGIN
 SELECT * INTO l FROM "DisputeSellerLiability" WHERE id=NEW."disputeSellerLiabilityId";
 SELECT * INTO s FROM "OrderFeeComponentSnapshot" WHERE id=NEW."orderFeeComponentSnapshotId";
 IF NOT FOUND OR s."orderId"<>l."orderId" OR s."componentKind" NOT IN ('LISTING_TIER','SELLER_MAX') OR s."partyCharged"<>'SELLER' OR s.formula<>'PERCENT_BPS' THEN RAISE EXCEPTION 'seller liability fee component unauthorized' USING ERRCODE='23514'; END IF;
 expected:="seller_liability_expected_allocation"(l."disputeFinancialDecisionId",s."feeAmountMinor");
 IF NEW."componentKind"<>s."componentKind" OR NEW."originalFrozenFeeAmountMinor"<>s."feeAmountMinor" OR NEW."reversalRequiredAmountMinor"<>expected THEN RAISE EXCEPTION 'seller liability fee allocation mismatch' USING ERRCODE='23514'; END IF;
 IF (SELECT COALESCE(sum(c."reversalRequiredAmountMinor"),0) FROM "DisputeSellerLiabilityFeeComponent" c JOIN "DisputeSellerLiability" x ON x.id=c."disputeSellerLiabilityId" WHERE x."orderId"=l."orderId" AND c."orderFeeComponentSnapshotId"=s.id)+expected>s."feeAmountMinor" THEN RAISE EXCEPTION 'seller liability cumulative fee exceeded' USING ERRCODE='23514'; END IF;
 NEW."createdAt":=l."createdAt"; RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE FUNCTION "validate_dispute_seller_liability_components"() RETURNS trigger AS $$
BEGIN
 IF (SELECT count(*) FROM "DisputeSellerLiabilityFeeComponent" WHERE "disputeSellerLiabilityId"=NEW.id)<>(SELECT count(*) FROM "OrderFeeComponentSnapshot" WHERE "orderId"=NEW."orderId" AND "componentKind" IN ('LISTING_TIER','SELLER_MAX')) OR (SELECT COALESCE(sum("reversalRequiredAmountMinor"),0) FROM "DisputeSellerLiabilityFeeComponent" WHERE "disputeSellerLiabilityId"=NEW.id)<>NEW."reversiblePlatformSellerFeeRequiredAmountMinor" THEN RAISE EXCEPTION 'seller liability fee breakdown incomplete' USING ERRCODE='23514'; END IF; RETURN NULL;
END; $$ LANGUAGE plpgsql;
CREATE FUNCTION "reject_dispute_seller_liability_mutation"() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'seller liability decomposition is append-only' USING ERRCODE='55000'; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "DisputeSellerLiability_insert_guard" BEFORE INSERT ON "DisputeSellerLiability" FOR EACH ROW EXECUTE FUNCTION "guard_dispute_seller_liability_insert"();
CREATE CONSTRAINT TRIGGER "DisputeSellerLiability_breakdown_guard" AFTER INSERT ON "DisputeSellerLiability" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "validate_dispute_seller_liability_components"();
CREATE TRIGGER "DisputeSellerLiability_append_only" BEFORE UPDATE OR DELETE ON "DisputeSellerLiability" FOR EACH ROW EXECUTE FUNCTION "reject_dispute_seller_liability_mutation"();
CREATE TRIGGER "DisputeSellerLiabilityFeeComponent_insert_guard" BEFORE INSERT ON "DisputeSellerLiabilityFeeComponent" FOR EACH ROW EXECUTE FUNCTION "guard_dispute_seller_liability_component_insert"();
CREATE TRIGGER "DisputeSellerLiabilityFeeComponent_append_only" BEFORE UPDATE OR DELETE ON "DisputeSellerLiabilityFeeComponent" FOR EACH ROW EXECUTE FUNCTION "reject_dispute_seller_liability_mutation"();
