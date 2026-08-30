CREATE TYPE "DisputeCaseStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED_BUYER', 'RESOLVED_SELLER', 'CLOSED');
CREATE TYPE "DisputeCaseEventType" AS ENUM ('CASE_OPENED', 'STATUS_CHANGED');

CREATE TABLE "DisputeCase" (
  "id" UUID NOT NULL,
  "orderId" UUID NOT NULL,
  "status" "DisputeCaseStatus" NOT NULL DEFAULT 'OPEN',
  "mutationActorId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "terminalAt" TIMESTAMP(3),
  CONSTRAINT "DisputeCase_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DisputeCase_id_orderId_key" UNIQUE ("id", "orderId"),
  CONSTRAINT "DisputeCase_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "DisputeCaseEvent" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "disputeCaseId" UUID NOT NULL,
  "orderId" UUID NOT NULL,
  "type" "DisputeCaseEventType" NOT NULL,
  "fromStatus" "DisputeCaseStatus",
  "toStatus" "DisputeCaseStatus" NOT NULL,
  "actorUserId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DisputeCaseEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DisputeCaseEvent_disputeCaseId_orderId_fkey" FOREIGN KEY ("disputeCaseId", "orderId") REFERENCES "DisputeCase"("id", "orderId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "DisputeCaseEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "DisputeCase_orderId_createdAt_id_idx" ON "DisputeCase"("orderId", "createdAt", "id");
CREATE INDEX "DisputeCaseEvent_disputeCaseId_createdAt_id_idx" ON "DisputeCaseEvent"("disputeCaseId", "createdAt", "id");
CREATE INDEX "DisputeCaseEvent_orderId_createdAt_id_idx" ON "DisputeCaseEvent"("orderId", "createdAt", "id");
CREATE UNIQUE INDEX "DisputeCase_one_active_per_order" ON "DisputeCase"("orderId") WHERE "status" IN ('OPEN', 'UNDER_REVIEW');

CREATE FUNCTION "dispute_case_audit_guard"() RETURNS trigger AS $$
DECLARE terminal boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'OPEN' OR NEW."terminalAt" IS NOT NULL THEN
      RAISE EXCEPTION 'new dispute case must start OPEN' USING ERRCODE = '23514';
    END IF;
    NEW."createdAt" := CURRENT_TIMESTAMP;
    NEW."updatedAt" := CURRENT_TIMESTAMP;
    RETURN NEW;
  END IF;
  IF NEW.id <> OLD.id OR NEW."orderId" <> OLD."orderId" OR NEW."createdAt" <> OLD."createdAt" THEN
    RAISE EXCEPTION 'dispute case identity is immutable' USING ERRCODE = '23514';
  END IF;
  IF OLD.status IN ('RESOLVED_BUYER', 'RESOLVED_SELLER', 'CLOSED') THEN
    RAISE EXCEPTION 'terminal dispute case is immutable' USING ERRCODE = '23514';
  END IF;
  IF NOT ((OLD.status = 'OPEN' AND NEW.status IN ('UNDER_REVIEW','RESOLVED_BUYER','RESOLVED_SELLER','CLOSED')) OR
          (OLD.status = 'UNDER_REVIEW' AND NEW.status IN ('RESOLVED_BUYER','RESOLVED_SELLER','CLOSED'))) THEN
    RAISE EXCEPTION 'invalid dispute case transition % -> %', OLD.status, NEW.status USING ERRCODE = '23514';
  END IF;
  terminal := NEW.status IN ('RESOLVED_BUYER', 'RESOLVED_SELLER', 'CLOSED');
  NEW."terminalAt" := CASE WHEN terminal THEN CURRENT_TIMESTAMP ELSE NULL END;
  NEW."updatedAt" := CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "guard_dispute_case_event_insert"() RETURNS trigger AS $$
BEGIN
  IF pg_trigger_depth() < 2 THEN
    RAISE EXCEPTION 'dispute case events are written only by the case audit trigger' USING ERRCODE = '55000';
  END IF;
  NEW."createdAt" := CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "dispute_case_write_audit_event"() RETURNS trigger AS $$
BEGIN
  INSERT INTO "DisputeCaseEvent" ("disputeCaseId", "orderId", "type", "fromStatus", "toStatus", "actorUserId")
  VALUES (NEW.id, NEW."orderId", CASE WHEN TG_OP = 'INSERT' THEN 'CASE_OPENED'::"DisputeCaseEventType" ELSE 'STATUS_CHANGED'::"DisputeCaseEventType" END,
          CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.status END, NEW.status, NEW."mutationActorId");
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "reject_dispute_case_event_mutation"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'dispute case events are append-only' USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "DisputeCase_guard" BEFORE INSERT OR UPDATE ON "DisputeCase" FOR EACH ROW EXECUTE FUNCTION "dispute_case_audit_guard"();
CREATE TRIGGER "DisputeCase_audit" AFTER INSERT OR UPDATE OF "status" ON "DisputeCase" FOR EACH ROW EXECUTE FUNCTION "dispute_case_write_audit_event"();
CREATE TRIGGER "DisputeCaseEvent_append_only" BEFORE UPDATE OR DELETE ON "DisputeCaseEvent" FOR EACH ROW EXECUTE FUNCTION "reject_dispute_case_event_mutation"();
CREATE TRIGGER "DisputeCaseEvent_insert_guard" BEFORE INSERT ON "DisputeCaseEvent" FOR EACH ROW EXECUTE FUNCTION "guard_dispute_case_event_insert"();
CREATE TRIGGER "DisputeCase_no_delete" BEFORE DELETE ON "DisputeCase" FOR EACH ROW EXECUTE FUNCTION "reject_dispute_case_event_mutation"();
