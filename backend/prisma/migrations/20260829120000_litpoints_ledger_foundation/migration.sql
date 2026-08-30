CREATE TYPE "LitPointsBucket" AS ENUM ('PENDING', 'AVAILABLE');

CREATE TABLE "LitPointsLedgerTransaction" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "operationKey" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceReference" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LitPointsLedgerTransaction_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "LitPointsLedgerTransaction_required_provenance" CHECK (
      length(btrim("operationKey")) > 0 AND
      length(btrim("operation")) > 0 AND
      length(btrim("source")) > 0 AND
      length(btrim("sourceReference")) > 0 AND
      length(btrim("requestHash")) > 0
    )
);

CREATE TABLE "LitPointsLedgerEntry" (
    "id" UUID NOT NULL,
    "transactionId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "bucket" "LitPointsBucket" NOT NULL,
    "delta" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LitPointsLedgerEntry_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "LitPointsLedgerEntry_nonzero_delta" CHECK ("delta" <> 0)
);

CREATE UNIQUE INDEX "LitPointsLedgerTransaction_operationKey_key"
  ON "LitPointsLedgerTransaction"("operationKey");
CREATE UNIQUE INDEX "LitPointsLedgerTransaction_id_userId_key"
  ON "LitPointsLedgerTransaction"("id", "userId");
CREATE INDEX "LitPointsLedgerTransaction_userId_createdAt_id_idx"
  ON "LitPointsLedgerTransaction"("userId", "createdAt", "id");
CREATE INDEX "LitPointsLedgerEntry_transactionId_idx"
  ON "LitPointsLedgerEntry"("transactionId");
CREATE INDEX "LitPointsLedgerEntry_userId_bucket_idx"
  ON "LitPointsLedgerEntry"("userId", "bucket");
CREATE INDEX "LitPointsLedgerEntry_userId_createdAt_id_idx"
  ON "LitPointsLedgerEntry"("userId", "createdAt", "id");

ALTER TABLE "LitPointsLedgerTransaction"
  ADD CONSTRAINT "LitPointsLedgerTransaction_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LitPointsLedgerEntry"
  ADD CONSTRAINT "LitPointsLedgerEntry_transactionId_userId_fkey"
  FOREIGN KEY ("transactionId", "userId")
  REFERENCES "LitPointsLedgerTransaction"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LitPointsLedgerEntry"
  ADD CONSTRAINT "LitPointsLedgerEntry_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION reject_litpoints_ledger_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'LIT Points ledger is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "LitPointsLedgerTransaction_append_only"
  BEFORE UPDATE OR DELETE ON "LitPointsLedgerTransaction"
  FOR EACH ROW EXECUTE FUNCTION reject_litpoints_ledger_mutation();
CREATE TRIGGER "LitPointsLedgerEntry_append_only"
  BEFORE UPDATE OR DELETE ON "LitPointsLedgerEntry"
  FOR EACH ROW EXECUTE FUNCTION reject_litpoints_ledger_mutation();
