CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TYPE "LedgerAccountPurpose" ADD VALUE 'RECOVERY_CLAIM_OBLIGATION';

CREATE TABLE "DisputeRecoveryClaimObligation" (
 "id" UUID NOT NULL DEFAULT gen_random_uuid(), "recoveryClaimId" UUID NOT NULL,
 "ledgerAccountId" UUID NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "DisputeRecoveryClaimObligation_pkey" PRIMARY KEY (id),
 CONSTRAINT "DisputeRecoveryClaimObligation_claim_key" UNIQUE ("recoveryClaimId"),
 CONSTRAINT "DisputeRecoveryClaimObligation_account_key" UNIQUE ("ledgerAccountId"),
 CONSTRAINT "DisputeRecoveryClaimObligation_claim_fkey" FOREIGN KEY ("recoveryClaimId") REFERENCES "DisputeRecoveryClaim"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "DisputeRecoveryClaimObligation_account_fkey" FOREIGN KEY ("ledgerAccountId") REFERENCES "LedgerAccount"(id) ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE TABLE "DisputeSellerDeficitOrigination" (
 "id" UUID NOT NULL DEFAULT gen_random_uuid(), "recoveryClaimId" UUID NOT NULL,
 "sellerProfileId" UUID NOT NULL, "obligationAccountId" UUID NOT NULL,
 "ledgerTransactionId" UUID NOT NULL, "amountMinor" BIGINT NOT NULL, "currency" TEXT NOT NULL DEFAULT 'BRL',
 "idempotencyKeyHash" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "DisputeSellerDeficitOrigination_pkey" PRIMARY KEY (id),
 CONSTRAINT "DisputeSellerDeficitOrigination_claim_key" UNIQUE ("recoveryClaimId"),
 CONSTRAINT "DisputeSellerDeficitOrigination_obligation_key" UNIQUE ("obligationAccountId"),
 CONSTRAINT "DisputeSellerDeficitOrigination_ledger_key" UNIQUE ("ledgerTransactionId"),
 CONSTRAINT "DisputeSellerDeficitOrigination_idempotency_key" UNIQUE ("idempotencyKeyHash"),
 CONSTRAINT "DisputeSellerDeficitOrigination_amount_check" CHECK ("amountMinor">0),
 CONSTRAINT "DisputeSellerDeficitOrigination_currency_check" CHECK (currency='BRL'),
 CONSTRAINT "DisputeSellerDeficitOrigination_claim_fkey" FOREIGN KEY ("recoveryClaimId") REFERENCES "DisputeRecoveryClaim"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "DisputeSellerDeficitOrigination_seller_fkey" FOREIGN KEY ("sellerProfileId") REFERENCES "SellerProfile"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "DisputeSellerDeficitOrigination_obligation_fkey" FOREIGN KEY ("obligationAccountId") REFERENCES "LedgerAccount"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "DisputeSellerDeficitOrigination_ledger_fkey" FOREIGN KEY ("ledgerTransactionId") REFERENCES "LedgerTransaction"(id) ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "DisputeSellerDeficitOrigination_seller_created_idx" ON "DisputeSellerDeficitOrigination"("sellerProfileId","createdAt",id);

CREATE FUNCTION "guard_recovery_claim_obligation_insert"() RETURNS trigger AS $$
DECLARE c "DisputeRecoveryClaim"%ROWTYPE; a "LedgerAccount"%ROWTYPE;
BEGIN
 SELECT * INTO c FROM "DisputeRecoveryClaim" WHERE id=NEW."recoveryClaimId";
 SELECT * INTO a FROM "LedgerAccount" WHERE id=NEW."ledgerAccountId";
 IF c.id IS NULL OR a.id IS NULL THEN RAISE EXCEPTION 'claim obligation authority missing' USING ERRCODE='23503'; END IF;
 IF a."ownerType"<>'SYSTEM' OR a."ownerId"<>c.id::text OR a."sellerProfileId" IS NOT NULL OR a."accountClass"<>'LIABILITY' OR a.purpose<>'RECOVERY_CLAIM_OBLIGATION' OR a.currency<>c.currency
 THEN RAISE EXCEPTION 'claim obligation account mismatch' USING ERRCODE='23514'; END IF;
 NEW."createdAt":=transaction_timestamp()::timestamp(3); RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE FUNCTION "guard_seller_deficit_origination_insert"() RETURNS trigger AS $$
DECLARE c "DisputeRecoveryClaim"%ROWTYPE; b "DisputeRecoveryClaimObligation"%ROWTYPE; t "LedgerTransaction"%ROWTYPE;
 reserved bigint; expected bigint; entry_count int; debit_count int; credit_count int;
BEGIN
 SELECT * INTO c FROM "DisputeRecoveryClaim" WHERE id=NEW."recoveryClaimId";
 IF c.id IS NULL THEN RAISE EXCEPTION 'deficit claim missing' USING ERRCODE='23503'; END IF;
 PERFORM id FROM "SellerProfile" WHERE id=c."sellerProfileId" FOR UPDATE;
 SELECT * INTO b FROM "DisputeRecoveryClaimObligation" WHERE "recoveryClaimId"=c.id;
 SELECT * INTO t FROM "LedgerTransaction" WHERE id=NEW."ledgerTransactionId";
 SELECT COALESCE(sum("amountMinor"),0) INTO reserved FROM "DisputeRecoveryReservation" WHERE "recoveryClaimId"=c.id;
 expected:=c."claimAmountMinor"-reserved;
 SELECT count(*),
 count(*) FILTER (WHERE e.direction='DEBIT' AND a.purpose='SELLER_DEFICIT' AND a."ownerType"='SELLER' AND a."ownerId"=c."sellerProfileId"::text AND a."sellerProfileId"=c."sellerProfileId" AND a."accountClass"='ASSET' AND a.currency='BRL' AND e."amountMinor"=expected),
 count(*) FILTER (WHERE e.direction='CREDIT' AND a.id=b."ledgerAccountId" AND a.purpose='RECOVERY_CLAIM_OBLIGATION' AND a."ownerType"='SYSTEM' AND a."accountClass"='LIABILITY' AND a.currency='BRL' AND e."amountMinor"=expected)
 INTO entry_count,debit_count,credit_count FROM "LedgerEntry" e JOIN "LedgerAccount" a ON a.id=e."accountId" WHERE e."transactionId"=NEW."ledgerTransactionId";
 IF expected<=0 OR NEW."sellerProfileId"<>c."sellerProfileId" OR NEW."obligationAccountId"<>b."ledgerAccountId" OR NEW."amountMinor"<>expected OR NEW.currency<>c.currency
 OR NEW."idempotencyKeyHash"<>encode(digest('dispute-seller-deficit:'||c.id::text||':initial-unfunded:v1','sha256'),'hex')
 OR t.id IS NULL OR t.type<>'DISPUTE_SELLER_DEFICIT_RECOGNIZED' OR t.currency<>'BRL' OR t."referenceType"<>'DisputeRecoveryClaim' OR t."referenceId"<>c.id
 OR t."idempotencyKeyHash"<>NEW."idempotencyKeyHash" OR entry_count<>2 OR debit_count<>1 OR credit_count<>1
 THEN RAISE EXCEPTION 'seller deficit origination mismatch' USING ERRCODE='23514'; END IF;
 NEW."createdAt":=transaction_timestamp()::timestamp(3); RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE FUNCTION "validate_deficit_ledger_origination"() RETURNS trigger AS $$ BEGIN
 IF NEW.type='DISPUTE_SELLER_DEFICIT_RECOGNIZED' AND (SELECT count(*) FROM "DisputeSellerDeficitOrigination" WHERE "ledgerTransactionId"=NEW.id)<>1
 THEN RAISE EXCEPTION 'deficit ledger transaction requires origination' USING ERRCODE='23514'; END IF; RETURN NULL; END; $$ LANGUAGE plpgsql;
CREATE FUNCTION "reject_aa1_mutation"() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'AA1 authority is append-only' USING ERRCODE='55000'; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "RecoveryClaimObligation_insert_guard" BEFORE INSERT ON "DisputeRecoveryClaimObligation" FOR EACH ROW EXECUTE FUNCTION "guard_recovery_claim_obligation_insert"();
CREATE TRIGGER "RecoveryClaimObligation_append_only" BEFORE UPDATE OR DELETE ON "DisputeRecoveryClaimObligation" FOR EACH ROW EXECUTE FUNCTION "reject_aa1_mutation"();
CREATE TRIGGER "SellerDeficitOrigination_insert_guard" BEFORE INSERT ON "DisputeSellerDeficitOrigination" FOR EACH ROW EXECUTE FUNCTION "guard_seller_deficit_origination_insert"();
CREATE TRIGGER "SellerDeficitOrigination_append_only" BEFORE UPDATE OR DELETE ON "DisputeSellerDeficitOrigination" FOR EACH ROW EXECUTE FUNCTION "reject_aa1_mutation"();
CREATE CONSTRAINT TRIGGER "DeficitLedger_origination_guard" AFTER INSERT ON "LedgerTransaction" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "validate_deficit_ledger_origination"();

CREATE FUNCTION "validate_claim_obligation_final_state"() RETURNS trigger AS $$
DECLARE account_id uuid; claim_id uuid;
BEGIN
 IF TG_TABLE_NAME='LedgerAccount' THEN account_id:=NEW.id; claim_id:=NEW."ownerId"::uuid; ELSE account_id:=NEW."ledgerAccountId"; claim_id:=NEW."recoveryClaimId"; END IF;
 IF (SELECT count(*) FROM "DisputeRecoveryClaimObligation" WHERE "ledgerAccountId"=account_id AND "recoveryClaimId"=claim_id)<>1
 OR (SELECT count(*) FROM "DisputeSellerDeficitOrigination" WHERE "obligationAccountId"=account_id AND "recoveryClaimId"=claim_id)<>1
 THEN RAISE EXCEPTION 'claim obligation requires binding and origination' USING ERRCODE='23514'; END IF;
 RETURN NULL;
END; $$ LANGUAGE plpgsql;
CREATE FUNCTION "guard_bound_ledger_account_mutation"() RETURNS trigger AS $$ BEGIN
 IF OLD.purpose='RECOVERY_CLAIM_OBLIGATION' OR EXISTS(SELECT 1 FROM "DisputeRecoveryClaimObligation" WHERE "ledgerAccountId"=OLD.id)
 THEN RAISE EXCEPTION 'claim obligation account is append-only' USING ERRCODE='55000'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql;
CREATE CONSTRAINT TRIGGER "ClaimObligation_account_final_guard" AFTER INSERT ON "LedgerAccount" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW WHEN (NEW.purpose='RECOVERY_CLAIM_OBLIGATION') EXECUTE FUNCTION "validate_claim_obligation_final_state"();
CREATE CONSTRAINT TRIGGER "ClaimObligation_binding_final_guard" AFTER INSERT ON "DisputeRecoveryClaimObligation" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "validate_claim_obligation_final_state"();
CREATE TRIGGER "ClaimObligation_account_append_only" BEFORE UPDATE OR DELETE ON "LedgerAccount" FOR EACH ROW EXECUTE FUNCTION "guard_bound_ledger_account_mutation"();
