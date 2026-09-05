CREATE TABLE "DisputeRecoveryClaim" (
 "id" UUID NOT NULL DEFAULT gen_random_uuid(), "disputeSellerLiabilityId" UUID NOT NULL,
 "disputeFinancialDecisionId" UUID NOT NULL, "disputeCaseId" UUID NOT NULL, "orderId" UUID NOT NULL,
 "buyerUserId" UUID NOT NULL, "sellerProfileId" UUID NOT NULL, "claimAmountMinor" BIGINT NOT NULL,
 "currency" TEXT NOT NULL DEFAULT 'BRL', "priorityAt" TIMESTAMP(3) NOT NULL,
 "prioritySourceId" UUID NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "DisputeRecoveryClaim_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "DisputeRecoveryClaim_liability_key" UNIQUE ("disputeSellerLiabilityId"),
 CONSTRAINT "DisputeRecoveryClaim_decision_key" UNIQUE ("disputeFinancialDecisionId"),
 CONSTRAINT "DisputeRecoveryClaim_case_key" UNIQUE ("disputeCaseId"),
 CONSTRAINT "DisputeRecoveryClaim_priority_key" UNIQUE ("sellerProfileId","priorityAt","prioritySourceId"),
 CONSTRAINT "DisputeRecoveryClaim_amount_check" CHECK ("claimAmountMinor">0),
 CONSTRAINT "DisputeRecoveryClaim_currency_check" CHECK (currency='BRL'),
 CONSTRAINT "DisputeRecoveryClaim_liability_fkey" FOREIGN KEY ("disputeSellerLiabilityId") REFERENCES "DisputeSellerLiability"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "DisputeRecoveryClaim_decision_fkey" FOREIGN KEY ("disputeFinancialDecisionId") REFERENCES "DisputeFinancialDecision"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "DisputeRecoveryClaim_case_fkey" FOREIGN KEY ("disputeCaseId") REFERENCES "DisputeCase"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "DisputeRecoveryClaim_order_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "DisputeRecoveryClaim_buyer_fkey" FOREIGN KEY ("buyerUserId") REFERENCES "User"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "DisputeRecoveryClaim_seller_fkey" FOREIGN KEY ("sellerProfileId") REFERENCES "SellerProfile"(id) ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "DisputeRecoveryClaim_fifo_idx" ON "DisputeRecoveryClaim"("sellerProfileId","priorityAt","prioritySourceId");

CREATE TABLE "DisputeRecoveryReservation" (
 "id" UUID NOT NULL DEFAULT gen_random_uuid(), "recoveryClaimId" UUID NOT NULL,
 "sellerProfileId" UUID NOT NULL, "ledgerTransactionId" UUID NOT NULL,
 "amountMinor" BIGINT NOT NULL, "fundingSource" TEXT NOT NULL DEFAULT 'AVAILABLE_BALANCE',
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "DisputeRecoveryReservation_pkey" PRIMARY KEY (id),
 CONSTRAINT "DisputeRecoveryReservation_claim_key" UNIQUE ("recoveryClaimId"),
 CONSTRAINT "DisputeRecoveryReservation_ledger_key" UNIQUE ("ledgerTransactionId"),
 CONSTRAINT "DisputeRecoveryReservation_amount_check" CHECK ("amountMinor">0),
 CONSTRAINT "DisputeRecoveryReservation_source_check" CHECK ("fundingSource"='AVAILABLE_BALANCE'),
 CONSTRAINT "DisputeRecoveryReservation_claim_fkey" FOREIGN KEY ("recoveryClaimId") REFERENCES "DisputeRecoveryClaim"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "DisputeRecoveryReservation_seller_fkey" FOREIGN KEY ("sellerProfileId") REFERENCES "SellerProfile"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "DisputeRecoveryReservation_ledger_fkey" FOREIGN KEY ("ledgerTransactionId") REFERENCES "LedgerTransaction"(id) ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "DisputeRecoveryReservation_seller_created_idx" ON "DisputeRecoveryReservation"("sellerProfileId","createdAt",id);

CREATE FUNCTION "guard_dispute_recovery_claim_insert"() RETURNS trigger AS $$
DECLARE l "DisputeSellerLiability"%ROWTYPE; d "DisputeFinancialDecision"%ROWTYPE;
BEGIN
 SELECT * INTO l FROM "DisputeSellerLiability" WHERE id=NEW."disputeSellerLiabilityId";
 IF NOT FOUND THEN RAISE EXCEPTION 'recovery claim liability not found' USING ERRCODE='23503'; END IF;
 SELECT * INTO d FROM "DisputeFinancialDecision" WHERE id=l."disputeFinancialDecisionId";
 IF l."sellerLiabilityAmountMinor"<=0 OR NEW."disputeFinancialDecisionId"<>l."disputeFinancialDecisionId"
 OR NEW."disputeCaseId"<>l."disputeCaseId" OR NEW."orderId"<>l."orderId"
 OR NEW."buyerUserId"<>l."buyerUserId" OR NEW."sellerProfileId"<>l."sellerProfileId"
 OR NEW."claimAmountMinor"<>l."sellerLiabilityAmountMinor" OR NEW.currency<>l.currency
 OR NEW."priorityAt"<>d."executableAt" OR NEW."prioritySourceId"<>d.id
 THEN RAISE EXCEPTION 'recovery claim authority mismatch' USING ERRCODE='23514'; END IF;
 NEW."createdAt":=transaction_timestamp()::timestamp(3); RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE FUNCTION "guard_dispute_recovery_reservation_insert"() RETURNS trigger AS $$
DECLARE c "DisputeRecoveryClaim"%ROWTYPE; t "LedgerTransaction"%ROWTYPE; debit_count int; credit_count int; entry_count int; reserved bigint; earlier_unfunded boolean;
BEGIN
 SELECT * INTO c FROM "DisputeRecoveryClaim" WHERE id=NEW."recoveryClaimId";
 IF NOT FOUND THEN RAISE EXCEPTION 'recovery reservation claim not found' USING ERRCODE='23503'; END IF;
 -- The same stable Seller row is the database serialization boundary for direct SQL too.
 PERFORM id FROM "SellerProfile" WHERE id=c."sellerProfileId" FOR UPDATE;
 SELECT * INTO t FROM "LedgerTransaction" WHERE id=NEW."ledgerTransactionId";
 SELECT count(*), count(*) FILTER (WHERE e.direction='DEBIT' AND a.purpose='SELLER_AVAILABLE' AND a."ownerType"='SELLER' AND a."ownerId"=c."sellerProfileId" AND a.currency='BRL' AND e."amountMinor"=NEW."amountMinor"), count(*) FILTER (WHERE e.direction='CREDIT' AND a.purpose='SELLER_RESERVED' AND a."ownerType"='SELLER' AND a."ownerId"=c."sellerProfileId" AND a.currency='BRL' AND e."amountMinor"=NEW."amountMinor")
 INTO entry_count,debit_count,credit_count FROM "LedgerEntry" e JOIN "LedgerAccount" a ON a.id=e."accountId" WHERE e."transactionId"=NEW."ledgerTransactionId";
 IF t.id IS NULL OR NEW."sellerProfileId"<>c."sellerProfileId" OR NEW."fundingSource"<>'AVAILABLE_BALANCE'
 OR t.type<>'DISPUTE_RECOVERY_RESERVED' OR t.currency<>'BRL' OR t."referenceType"<>'DisputeRecoveryClaim' OR t."referenceId"<>c.id
 OR entry_count<>2 OR debit_count<>1 OR credit_count<>1
 THEN RAISE EXCEPTION 'recovery reservation ledger mismatch' USING ERRCODE='23514'; END IF;
 SELECT COALESCE(sum("amountMinor"),0) INTO reserved FROM "DisputeRecoveryReservation" WHERE "recoveryClaimId"=c.id;
 IF reserved+NEW."amountMinor">c."claimAmountMinor" THEN RAISE EXCEPTION 'recovery claim funding exceeded' USING ERRCODE='23514'; END IF;
 SELECT EXISTS(
  SELECT 1 FROM "DisputeSellerLiability" l JOIN "DisputeFinancialDecision" d ON d.id=l."disputeFinancialDecisionId"
  LEFT JOIN "DisputeRecoveryClaim" prior ON prior."disputeSellerLiabilityId"=l.id
  WHERE l."sellerProfileId"=c."sellerProfileId" AND l."sellerLiabilityAmountMinor">0
   AND (d."executableAt",d.id)<(c."priorityAt",c."prioritySourceId")
   AND (prior.id IS NULL OR COALESCE((SELECT sum(r."amountMinor") FROM "DisputeRecoveryReservation" r WHERE r."recoveryClaimId"=prior.id),0)<prior."claimAmountMinor")
 ) INTO earlier_unfunded;
 IF earlier_unfunded THEN RAISE EXCEPTION 'recovery FIFO priority violation' USING ERRCODE='23514'; END IF;
 NEW."createdAt":=transaction_timestamp()::timestamp(3); RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE FUNCTION "validate_recovery_ledger_allocation"() RETURNS trigger AS $$
BEGIN
 IF NEW.type='DISPUTE_RECOVERY_RESERVED' AND NOT EXISTS(SELECT 1 FROM "DisputeRecoveryReservation" WHERE "ledgerTransactionId"=NEW.id)
 THEN RAISE EXCEPTION 'recovery ledger transaction requires allocation' USING ERRCODE='23514'; END IF;
 RETURN NULL;
END; $$ LANGUAGE plpgsql;
CREATE FUNCTION "reject_dispute_recovery_mutation"() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'dispute recovery authority is append-only' USING ERRCODE='55000'; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "DisputeRecoveryClaim_insert_guard" BEFORE INSERT ON "DisputeRecoveryClaim" FOR EACH ROW EXECUTE FUNCTION "guard_dispute_recovery_claim_insert"();
CREATE TRIGGER "DisputeRecoveryClaim_append_only" BEFORE UPDATE OR DELETE ON "DisputeRecoveryClaim" FOR EACH ROW EXECUTE FUNCTION "reject_dispute_recovery_mutation"();
CREATE TRIGGER "DisputeRecoveryReservation_insert_guard" BEFORE INSERT ON "DisputeRecoveryReservation" FOR EACH ROW EXECUTE FUNCTION "guard_dispute_recovery_reservation_insert"();
CREATE TRIGGER "DisputeRecoveryReservation_append_only" BEFORE UPDATE OR DELETE ON "DisputeRecoveryReservation" FOR EACH ROW EXECUTE FUNCTION "reject_dispute_recovery_mutation"();
CREATE CONSTRAINT TRIGGER "RecoveryLedger_allocation_guard" AFTER INSERT ON "LedgerTransaction" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "validate_recovery_ledger_allocation"();
