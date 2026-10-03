CREATE OR REPLACE FUNCTION "guard_bound_ledger_account_mutation"() RETURNS trigger AS $$
BEGIN
 IF OLD.purpose='RECOVERY_CLAIM_OBLIGATION'
    OR EXISTS(
      SELECT 1 FROM "DisputeRecoveryClaimObligation"
      WHERE "ledgerAccountId"=OLD.id
    )
 THEN
   RAISE EXCEPTION 'claim obligation account is append-only' USING ERRCODE='55000';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END; $$ LANGUAGE plpgsql;
