-- CreateEnum
CREATE TYPE "PaymentAttemptStatus" AS ENUM ('CREATED', 'PENDING', 'PROCESSING', 'REQUIRES_ACTION', 'SUCCEEDED', 'FAILED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('PIX', 'BOLETO', 'CARD');

-- CreateEnum
CREATE TYPE "ProviderAccountOwner" AS ENUM ('PLATFORM', 'SELLER');

-- CreateEnum
CREATE TYPE "ProviderAccountStatus" AS ENUM ('PENDING_ONBOARDING', 'PENDING_KYC', 'ACTIVE', 'RESTRICTED', 'SUSPENDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "LedgerOwnerType" AS ENUM ('SYSTEM', 'PLATFORM', 'SELLER');

-- CreateEnum
CREATE TYPE "LedgerAccountClass" AS ENUM ('ASSET', 'LIABILITY', 'REVENUE', 'EXPENSE', 'EQUITY');

-- CreateEnum
CREATE TYPE "LedgerAccountPurpose" AS ENUM ('PROVIDER_CLEARING', 'SELLER_PENDING', 'SELLER_HELD', 'SELLER_AVAILABLE', 'SELLER_RESERVED', 'SELLER_DEFICIT', 'PLATFORM_COMMISSION', 'PLATFORM_WITHDRAWAL_FEE', 'PSP_FEE_EXPENSE', 'BUYER_REFUND_CLEARING', 'WITHDRAWAL_CLEARING', 'CHARGEBACK_RESERVE');

-- CreateEnum
CREATE TYPE "LedgerDirection" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "FinancialHoldStatus" AS ENUM ('ACTIVE', 'RELEASE_ELIGIBLE', 'RELEASE_REQUESTED', 'RELEASED', 'BLOCKED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FinancialHoldReason" AS ENUM ('DELIVERY_PROTECTION', 'DISPUTE', 'CHARGEBACK_RESERVE', 'RISK_REVIEW', 'MANUAL');

-- CreateEnum
CREATE TYPE "SettlementStatus" AS ENUM ('PENDING', 'HELD', 'AVAILABLE', 'REVERSED', 'FAILED');

-- CreateEnum
CREATE TYPE "TransferStatus" AS ENUM ('CREATED', 'PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WithdrawalSpeed" AS ENUM ('STANDARD', 'INSTANT');

-- CreateEnum
CREATE TYPE "WithdrawalApprovalMode" AS ENUM ('MANUAL', 'AUTOMATIC');

-- CreateEnum
CREATE TYPE "WithdrawalStatus" AS ENUM ('REQUESTED', 'PENDING_REVIEW', 'APPROVED', 'PROCESSING', 'SUCCEEDED', 'REJECTED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('REQUESTED', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ChargebackStatus" AS ENUM ('OPEN', 'EVIDENCE_REQUIRED', 'CONTESTED', 'WON', 'LOST', 'CLOSED');

-- CreateEnum
CREATE TYPE "ProviderWebhookEventStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'PROCESSED', 'FAILED', 'DEAD_LETTER', 'IGNORED');

-- CreateEnum
CREATE TYPE "ReconciliationIssueStatus" AS ENUM ('OPEN', 'INVESTIGATING', 'RESOLVED');

-- CreateEnum
CREATE TYPE "ReconciliationIssueType" AS ENUM ('AMOUNT_MISMATCH', 'STATUS_MISMATCH', 'MISSING_LOCAL', 'MISSING_PROVIDER', 'DUPLICATE_EXTERNAL_EVENT', 'LATE_PAYMENT', 'AMBIGUOUS_TRANSFER', 'OTHER');

-- CreateEnum
CREATE TYPE "FinancialOutboxStatus" AS ENUM ('PENDING', 'PUBLISHED', 'FAILED');

-- CreateEnum
CREATE TYPE "FeePolicyStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'ACTIVE', 'RETIRED');

-- CreateEnum
CREATE TYPE "FeeFormula" AS ENUM ('FIXED', 'PERCENT_BPS', 'PERCENT_BPS_PLUS_FIXED');

-- CreateEnum
CREATE TYPE "FeeRuleCategory" AS ENUM ('PLATFORM_COMMISSION', 'BUYER_SERVICE_FEE', 'PAYMENT_METHOD_SURCHARGE', 'CARD_FEE', 'INSTALLMENT_FEE', 'BOLETO_FEE', 'PIX_FEE', 'PROMOTION_PRICE', 'LIT_MAX_PRICE', 'LIT_MAX_REDUCTION', 'SELLER_LEVEL_ADJUSTMENT', 'BUYER_BENEFIT', 'WITHDRAWAL_FEE', 'OTHER');

-- CreateEnum
CREATE TYPE "FeeParty" AS ENUM ('BUYER', 'SELLER', 'PLATFORM');

-- CreateEnum
CREATE TYPE "WithdrawalPolicyStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'ACTIVE', 'RETIRED');

-- CreateTable
CREATE TABLE "Payment" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentProviderAccount" (
    "id" UUID NOT NULL,
    "providerCode" TEXT NOT NULL,
    "owner" "ProviderAccountOwner" NOT NULL,
    "sellerProfileId" UUID,
    "externalAccountId" TEXT NOT NULL,
    "status" "ProviderAccountStatus" NOT NULL DEFAULT 'PENDING_ONBOARDING',
    "providerStatusRaw" TEXT,
    "secretRef" TEXT,
    "canCreateCharges" BOOLEAN NOT NULL DEFAULT false,
    "canReceive" BOOLEAN NOT NULL DEFAULT false,
    "canSplit" BOOLEAN NOT NULL DEFAULT false,
    "canUseHold" BOOLEAN NOT NULL DEFAULT false,
    "canWithdraw" BOOLEAN NOT NULL DEFAULT false,
    "canRefund" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentProviderAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAttempt" (
    "id" UUID NOT NULL,
    "paymentId" UUID NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "providerCode" TEXT NOT NULL,
    "providerAccountId" UUID,
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentAttemptStatus" NOT NULL DEFAULT 'CREATED',
    "amountMinor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "externalPaymentId" TEXT,
    "externalAttemptId" TEXT,
    "providerStatusRaw" TEXT,
    "idempotencyKeyHash" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerAccount" (
    "id" UUID NOT NULL,
    "ownerType" "LedgerOwnerType" NOT NULL,
    "ownerId" TEXT NOT NULL,
    "sellerProfileId" UUID,
    "accountClass" "LedgerAccountClass" NOT NULL,
    "purpose" "LedgerAccountPurpose" NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerTransaction" (
    "id" UUID NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "type" TEXT NOT NULL,
    "referenceType" TEXT,
    "referenceId" UUID,
    "idempotencyKeyHash" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "reversalOfId" UUID,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" UUID NOT NULL,
    "transactionId" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "direction" "LedgerDirection" NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialHold" (
    "id" UUID NOT NULL,
    "sellerProfileId" UUID NOT NULL,
    "paymentId" UUID,
    "amountMinor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "reason" "FinancialHoldReason" NOT NULL,
    "status" "FinancialHoldStatus" NOT NULL DEFAULT 'ACTIVE',
    "releaseEligibleAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialHold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settlement" (
    "id" UUID NOT NULL,
    "paymentId" UUID NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "status" "SettlementStatus" NOT NULL DEFAULT 'PENDING',
    "externalSettlementId" TEXT,
    "availableAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transfer" (
    "id" UUID NOT NULL,
    "providerCode" TEXT NOT NULL,
    "externalTransferId" TEXT,
    "amountMinor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "status" "TransferStatus" NOT NULL DEFAULT 'CREATED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Withdrawal" (
    "id" UUID NOT NULL,
    "sellerProfileId" UUID NOT NULL,
    "speed" "WithdrawalSpeed" NOT NULL DEFAULT 'STANDARD',
    "approvalMode" "WithdrawalApprovalMode" NOT NULL DEFAULT 'MANUAL',
    "debitAmountMinor" BIGINT NOT NULL,
    "feeAmountMinor" BIGINT NOT NULL DEFAULT 0,
    "payoutAmountMinor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "status" "WithdrawalStatus" NOT NULL DEFAULT 'REQUESTED',
    "slaDueAt" TIMESTAMP(3) NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedByUserId" UUID,
    "rejectionReasonCode" TEXT,
    "approvedAt" TIMESTAMP(3),
    "processingAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "providerAccountId" UUID,
    "transferId" UUID,
    "destinationRef" TEXT NOT NULL,
    "idempotencyKeyHash" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "failureCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Withdrawal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Refund" (
    "id" UUID NOT NULL,
    "paymentId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "status" "RefundStatus" NOT NULL DEFAULT 'REQUESTED',
    "reasonCode" TEXT NOT NULL,
    "requestedByUserId" UUID,
    "providerCode" TEXT,
    "externalRefundId" TEXT,
    "idempotencyKeyHash" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processingAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chargeback" (
    "id" UUID NOT NULL,
    "paymentId" UUID NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "status" "ChargebackStatus" NOT NULL DEFAULT 'OPEN',
    "providerCode" TEXT,
    "externalChargebackId" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Chargeback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderWebhookEvent" (
    "id" UUID NOT NULL,
    "providerCode" TEXT NOT NULL,
    "externalEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "status" "ProviderWebhookEventStatus" NOT NULL DEFAULT 'RECEIVED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "lastErrorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReconciliationIssue" (
    "id" UUID NOT NULL,
    "providerCode" TEXT,
    "type" "ReconciliationIssueType" NOT NULL,
    "status" "ReconciliationIssueStatus" NOT NULL DEFAULT 'OPEN',
    "referenceType" TEXT,
    "referenceId" TEXT,
    "expectedAmountMinor" BIGINT,
    "observedAmountMinor" BIGINT,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "details" JSONB NOT NULL DEFAULT '{}',
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReconciliationIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialEvent" (
    "id" UUID NOT NULL,
    "ledgerTransactionId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "actorUserId" UUID,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialOutboxEvent" (
    "id" UUID NOT NULL,
    "financialEventId" UUID NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "FinancialOutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),
    "lastErrorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialOutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeePolicyVersion" (
    "id" UUID NOT NULL,
    "publicVersion" INTEGER NOT NULL,
    "status" "FeePolicyStatus" NOT NULL DEFAULT 'DRAFT',
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "createdByUserId" UUID NOT NULL,
    "publishedByUserId" UUID,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeePolicyVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeRule" (
    "id" UUID NOT NULL,
    "policyVersionId" UUID NOT NULL,
    "category" "FeeRuleCategory" NOT NULL,
    "code" TEXT NOT NULL,
    "formula" "FeeFormula" NOT NULL,
    "partyCharged" "FeeParty" NOT NULL,
    "percentBps" INTEGER,
    "fixedAmountMinor" BIGINT,
    "minimumAmountMinor" BIGINT,
    "maximumAmountMinor" BIGINT,
    "paymentMethod" "PaymentMethod",
    "installmentsFrom" INTEGER,
    "installmentsTo" INTEGER,
    "sellerLevel" TEXT,
    "sellerPlan" TEXT,
    "promotionTier" TEXT,
    "withdrawalSpeed" "WithdrawalSpeed",
    "productType" "CatalogProductType",
    "priority" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeeRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WithdrawalPolicyVersion" (
    "id" UUID NOT NULL,
    "publicVersion" INTEGER NOT NULL,
    "status" "WithdrawalPolicyStatus" NOT NULL DEFAULT 'DRAFT',
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "createdByUserId" UUID NOT NULL,
    "publishedByUserId" UUID,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WithdrawalPolicyVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WithdrawalPolicyRule" (
    "id" UUID NOT NULL,
    "policyVersionId" UUID NOT NULL,
    "speed" "WithdrawalSpeed" NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "slaHours" INTEGER NOT NULL,
    "approvalMode" "WithdrawalApprovalMode" NOT NULL,
    "feeFormula" "FeeFormula" NOT NULL DEFAULT 'FIXED',
    "feePercentBps" INTEGER,
    "feeFixedAmountMinor" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WithdrawalPolicyRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Payment_orderId_key" ON "Payment"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_id_orderId_key" ON "Payment"("id", "orderId");

-- CreateIndex
CREATE INDEX "PaymentProviderAccount_sellerProfileId_status_idx" ON "PaymentProviderAccount"("sellerProfileId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentProviderAccount_providerCode_externalAccountId_key" ON "PaymentProviderAccount"("providerCode", "externalAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAttempt_paymentId_attemptNumber_key" ON "PaymentAttempt"("paymentId", "attemptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAttempt_providerCode_externalPaymentId_key" ON "PaymentAttempt"("providerCode", "externalPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAttempt_providerCode_externalAttemptId_key" ON "PaymentAttempt"("providerCode", "externalAttemptId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAttempt_providerCode_idempotencyKeyHash_key" ON "PaymentAttempt"("providerCode", "idempotencyKeyHash");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerAccount_ownerType_ownerId_purpose_currency_key" ON "LedgerAccount"("ownerType", "ownerId", "purpose", "currency");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerTransaction_idempotencyKeyHash_key" ON "LedgerTransaction"("idempotencyKeyHash");

-- CreateIndex
CREATE INDEX "LedgerEntry_transactionId_idx" ON "LedgerEntry"("transactionId");

-- CreateIndex
CREATE INDEX "LedgerEntry_accountId_createdAt_idx" ON "LedgerEntry"("accountId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Transfer_providerCode_externalTransferId_key" ON "Transfer"("providerCode", "externalTransferId");

-- CreateIndex
CREATE UNIQUE INDEX "Withdrawal_transferId_key" ON "Withdrawal"("transferId");

-- CreateIndex
CREATE UNIQUE INDEX "Withdrawal_idempotencyKeyHash_key" ON "Withdrawal"("idempotencyKeyHash");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_idempotencyKeyHash_key" ON "Refund"("idempotencyKeyHash");

-- CreateIndex
CREATE INDEX "Refund_orderId_status_idx" ON "Refund"("orderId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_providerCode_externalRefundId_key" ON "Refund"("providerCode", "externalRefundId");

-- CreateIndex
CREATE UNIQUE INDEX "Chargeback_providerCode_externalChargebackId_key" ON "Chargeback"("providerCode", "externalChargebackId");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderWebhookEvent_providerCode_externalEventId_key" ON "ProviderWebhookEvent"("providerCode", "externalEventId");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialEvent_ledgerTransactionId_key" ON "FinancialEvent"("ledgerTransactionId");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialOutboxEvent_financialEventId_key" ON "FinancialOutboxEvent"("financialEventId");

-- CreateIndex
CREATE UNIQUE INDEX "FeePolicyVersion_publicVersion_key" ON "FeePolicyVersion"("publicVersion");

-- CreateIndex
CREATE UNIQUE INDEX "FeeRule_policyVersionId_code_key" ON "FeeRule"("policyVersionId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "WithdrawalPolicyVersion_publicVersion_key" ON "WithdrawalPolicyVersion"("publicVersion");

-- CreateIndex
CREATE UNIQUE INDEX "WithdrawalPolicyRule_policyVersionId_speed_key" ON "WithdrawalPolicyRule"("policyVersionId", "speed");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentProviderAccount" ADD CONSTRAINT "PaymentProviderAccount_sellerProfileId_fkey" FOREIGN KEY ("sellerProfileId") REFERENCES "SellerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentProviderAccount" ADD CONSTRAINT "PaymentProviderAccount_owner_consistency" CHECK ((owner = 'SELLER' AND "sellerProfileId" IS NOT NULL) OR (owner = 'PLATFORM' AND "sellerProfileId" IS NULL));

-- AddForeignKey
ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_providerAccountId_fkey" FOREIGN KEY ("providerAccountId") REFERENCES "PaymentProviderAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerAccount" ADD CONSTRAINT "LedgerAccount_sellerProfileId_fkey" FOREIGN KEY ("sellerProfileId") REFERENCES "SellerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LedgerAccount" ADD CONSTRAINT "LedgerAccount_owner_consistency" CHECK (("ownerType" = 'SELLER' AND "sellerProfileId" IS NOT NULL AND "ownerId" = "sellerProfileId"::text) OR ("ownerType" IN ('SYSTEM', 'PLATFORM') AND "sellerProfileId" IS NULL));

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "LedgerTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "LedgerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialHold" ADD CONSTRAINT "FinancialHold_sellerProfileId_fkey" FOREIGN KEY ("sellerProfileId") REFERENCES "SellerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialHold" ADD CONSTRAINT "FinancialHold_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Withdrawal" ADD CONSTRAINT "Withdrawal_sellerProfileId_fkey" FOREIGN KEY ("sellerProfileId") REFERENCES "SellerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Withdrawal" ADD CONSTRAINT "Withdrawal_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Withdrawal" ADD CONSTRAINT "Withdrawal_providerAccountId_fkey" FOREIGN KEY ("providerAccountId") REFERENCES "PaymentProviderAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Withdrawal" ADD CONSTRAINT "Withdrawal_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "Transfer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_paymentId_orderId_fkey" FOREIGN KEY ("paymentId", "orderId") REFERENCES "Payment"("id", "orderId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chargeback" ADD CONSTRAINT "Chargeback_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialEvent" ADD CONSTRAINT "FinancialEvent_ledgerTransactionId_fkey" FOREIGN KEY ("ledgerTransactionId") REFERENCES "LedgerTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialEvent" ADD CONSTRAINT "FinancialEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialOutboxEvent" ADD CONSTRAINT "FinancialOutboxEvent_financialEventId_fkey" FOREIGN KEY ("financialEventId") REFERENCES "FinancialEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeePolicyVersion" ADD CONSTRAINT "FeePolicyVersion_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeePolicyVersion" ADD CONSTRAINT "FeePolicyVersion_publishedByUserId_fkey" FOREIGN KEY ("publishedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeRule" ADD CONSTRAINT "FeeRule_policyVersionId_fkey" FOREIGN KEY ("policyVersionId") REFERENCES "FeePolicyVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WithdrawalPolicyVersion" ADD CONSTRAINT "WithdrawalPolicyVersion_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WithdrawalPolicyVersion" ADD CONSTRAINT "WithdrawalPolicyVersion_publishedByUserId_fkey" FOREIGN KEY ("publishedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WithdrawalPolicyRule" ADD CONSTRAINT "WithdrawalPolicyRule_policyVersionId_fkey" FOREIGN KEY ("policyVersionId") REFERENCES "WithdrawalPolicyVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Authoritative financial invariants intentionally live below Prisma's model layer.
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_real_status" CHECK (status <> 'NOT_CREATED'),
  ADD CONSTRAINT "Payment_positive_amount" CHECK ("amountMinor" > 0),
  ADD CONSTRAINT "Payment_brl" CHECK (currency = 'BRL');
ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_positive_amount" CHECK ("amountMinor" > 0), ADD CONSTRAINT "PaymentAttempt_attempt_positive" CHECK ("attemptNumber" > 0);
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_positive_amount" CHECK ("amountMinor" > 0);
ALTER TABLE "Withdrawal" ADD CONSTRAINT "Withdrawal_amount_equation" CHECK ("debitAmountMinor" > 0 AND "payoutAmountMinor" > 0 AND "feeAmountMinor" >= 0 AND "debitAmountMinor" = "payoutAmountMinor" + "feeAmountMinor"), ADD CONSTRAINT "Withdrawal_standard_zero_fee" CHECK (speed <> 'STANDARD' OR "feeAmountMinor" = 0);
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_positive_amount" CHECK ("amountMinor" > 0);
ALTER TABLE "FeeRule" ADD CONSTRAINT "FeeRule_configuration" CHECK (
 ("percentBps" IS NULL OR "percentBps" >= 0) AND ("fixedAmountMinor" IS NULL OR "fixedAmountMinor" >= 0) AND
 ("minimumAmountMinor" IS NULL OR "minimumAmountMinor" >= 0) AND ("maximumAmountMinor" IS NULL OR "maximumAmountMinor" >= 0) AND
 ("minimumAmountMinor" IS NULL OR "maximumAmountMinor" IS NULL OR "minimumAmountMinor" <= "maximumAmountMinor") AND
 ("installmentsFrom" IS NULL OR "installmentsFrom" > 0) AND ("installmentsTo" IS NULL OR "installmentsTo" > 0) AND
 ("installmentsFrom" IS NULL OR "installmentsTo" IS NULL OR "installmentsFrom" <= "installmentsTo") AND
 ((formula='FIXED' AND "fixedAmountMinor" IS NOT NULL AND "percentBps" IS NULL) OR
  (formula='PERCENT_BPS' AND "percentBps" IS NOT NULL AND "fixedAmountMinor" IS NULL) OR
  (formula='PERCENT_BPS_PLUS_FIXED' AND "percentBps" IS NOT NULL AND "fixedAmountMinor" IS NOT NULL))
);
ALTER TABLE "WithdrawalPolicyRule" ADD CONSTRAINT "WithdrawalPolicyRule_valid" CHECK (
 "slaHours" > 0 AND ("feePercentBps" IS NULL OR "feePercentBps" >= 0) AND "feeFixedAmountMinor" >= 0 AND
 (("feeFormula"='FIXED' AND "feePercentBps" IS NULL) OR
  ("feeFormula"='PERCENT_BPS' AND "feePercentBps" IS NOT NULL AND "feeFixedAmountMinor"=0) OR
  ("feeFormula"='PERCENT_BPS_PLUS_FIXED' AND "feePercentBps" IS NOT NULL))
);

CREATE FUNCTION financial_reject_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'FINANCIAL_APPEND_ONLY: % cannot be %', TG_TABLE_NAME, TG_OP USING ERRCODE='55000'; END $$;
CREATE TRIGGER ledger_transaction_append_only BEFORE UPDATE OR DELETE ON "LedgerTransaction" FOR EACH ROW EXECUTE FUNCTION financial_reject_mutation();
CREATE TRIGGER ledger_entry_append_only BEFORE UPDATE OR DELETE ON "LedgerEntry" FOR EACH ROW EXECUTE FUNCTION financial_reject_mutation();
CREATE TRIGGER financial_event_append_only BEFORE UPDATE OR DELETE ON "FinancialEvent" FOR EACH ROW EXECUTE FUNCTION financial_reject_mutation();

CREATE FUNCTION financial_validate_ledger_id(tid uuid) RETURNS void LANGUAGE plpgsql AS $$
DECLARE entry_count bigint; debits numeric; credits numeric; currencies bigint;
BEGIN
 SELECT count(*), COALESCE(sum(CASE WHEN e.direction='DEBIT' THEN e."amountMinor" ELSE 0 END),0), COALESCE(sum(CASE WHEN e.direction='CREDIT' THEN e."amountMinor" ELSE 0 END),0), count(DISTINCT a.currency)
 INTO entry_count,debits,credits,currencies FROM "LedgerEntry" e JOIN "LedgerAccount" a ON a.id=e."accountId" WHERE e."transactionId"=tid;
 IF entry_count < 2 THEN RAISE EXCEPTION 'LEDGER_REQUIRES_TWO_ENTRIES' USING ERRCODE='23514'; END IF;
 IF debits <> credits THEN RAISE EXCEPTION 'LEDGER_UNBALANCED' USING ERRCODE='23514'; END IF;
 IF currencies <> 1 OR EXISTS(SELECT 1 FROM "LedgerEntry" e JOIN "LedgerAccount" a ON a.id=e."accountId" JOIN "LedgerTransaction" t ON t.id=e."transactionId" WHERE e."transactionId"=tid AND a.currency<>t.currency) THEN RAISE EXCEPTION 'LEDGER_CURRENCY_MISMATCH' USING ERRCODE='23514'; END IF;
END $$;
CREATE FUNCTION financial_validate_ledger_transaction() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM financial_validate_ledger_id(NEW.id); RETURN NULL; END $$;
CREATE FUNCTION financial_validate_ledger_entry() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM financial_validate_ledger_id(NEW."transactionId"); RETURN NULL; END $$;
CREATE CONSTRAINT TRIGGER ledger_transaction_balanced AFTER INSERT ON "LedgerTransaction" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION financial_validate_ledger_transaction();
CREATE CONSTRAINT TRIGGER ledger_entry_balanced AFTER INSERT ON "LedgerEntry" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION financial_validate_ledger_entry();

CREATE FUNCTION financial_protected_balance() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE aid uuid; resulting numeric;
BEGIN
 aid:=NEW."accountId";
 IF EXISTS(SELECT 1 FROM "LedgerAccount" WHERE id=aid AND purpose IN ('SELLER_PENDING','SELLER_HELD','SELLER_AVAILABLE','SELLER_RESERVED')) THEN
  SELECT COALESCE(sum(CASE WHEN direction='CREDIT' THEN "amountMinor" ELSE -"amountMinor" END),0) INTO resulting FROM "LedgerEntry" WHERE "accountId"=aid;
  IF resulting < 0 THEN RAISE EXCEPTION 'INSUFFICIENT_FINANCIAL_BALANCE' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER ledger_protected_balance AFTER INSERT ON "LedgerEntry" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION financial_protected_balance();

CREATE FUNCTION financial_withdrawal_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'WITHDRAWAL_REQUEST_IMMUTABLE' USING ERRCODE='55000'; END IF;
 IF NEW."sellerProfileId" IS DISTINCT FROM OLD."sellerProfileId" OR NEW.speed IS DISTINCT FROM OLD.speed OR NEW."approvalMode" IS DISTINCT FROM OLD."approvalMode" OR NEW."debitAmountMinor" IS DISTINCT FROM OLD."debitAmountMinor" OR NEW."feeAmountMinor" IS DISTINCT FROM OLD."feeAmountMinor" OR NEW."payoutAmountMinor" IS DISTINCT FROM OLD."payoutAmountMinor" OR NEW.currency IS DISTINCT FROM OLD.currency OR NEW."slaDueAt" IS DISTINCT FROM OLD."slaDueAt" OR NEW."requestedAt" IS DISTINCT FROM OLD."requestedAt" OR NEW."destinationRef" IS DISTINCT FROM OLD."destinationRef" OR NEW."idempotencyKeyHash" IS DISTINCT FROM OLD."idempotencyKeyHash" OR NEW."requestHash" IS DISTINCT FROM OLD."requestHash" THEN
  RAISE EXCEPTION 'WITHDRAWAL_REQUEST_IMMUTABLE' USING ERRCODE='55000';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER withdrawal_request_immutable BEFORE UPDATE OR DELETE ON "Withdrawal" FOR EACH ROW EXECUTE FUNCTION financial_withdrawal_guard();

CREATE FUNCTION financial_policy_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE allowed boolean;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'PUBLISHED_POLICY_IMMUTABLE' USING ERRCODE='55000'; END IF;
 allowed := (OLD.status='DRAFT' AND NEW.status IN ('DRAFT','SCHEDULED','ACTIVE','RETIRED')) OR
            (OLD.status='SCHEDULED' AND NEW.status IN ('SCHEDULED','ACTIVE','RETIRED')) OR
            (OLD.status='ACTIVE' AND NEW.status IN ('ACTIVE','RETIRED')) OR
            (OLD.status='RETIRED' AND NEW.status='RETIRED');
 IF NOT allowed THEN RAISE EXCEPTION 'INVALID_POLICY_TRANSITION' USING ERRCODE='23514'; END IF;
 IF OLD.status <> 'DRAFT' AND (NEW."publicVersion" IS DISTINCT FROM OLD."publicVersion" OR NEW."effectiveFrom" IS DISTINCT FROM OLD."effectiveFrom" OR NEW."effectiveTo" IS DISTINCT FROM OLD."effectiveTo" OR NEW."createdByUserId" IS DISTINCT FROM OLD."createdByUserId" OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt" OR NEW."publishedByUserId" IS DISTINCT FROM OLD."publishedByUserId" OR NEW."publishedAt" IS DISTINCT FROM OLD."publishedAt") THEN
  RAISE EXCEPTION 'PUBLISHED_POLICY_IMMUTABLE' USING ERRCODE='55000';
 END IF;
 IF NEW.status <> 'DRAFT' AND (NEW."publishedByUserId" IS NULL OR NEW."publishedAt" IS NULL) THEN RAISE EXCEPTION 'POLICY_PUBLICATION_AUDIT_REQUIRED' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER fee_policy_immutable BEFORE UPDATE OR DELETE ON "FeePolicyVersion" FOR EACH ROW EXECUTE FUNCTION financial_policy_guard();
CREATE TRIGGER withdrawal_policy_immutable BEFORE UPDATE OR DELETE ON "WithdrawalPolicyVersion" FOR EACH ROW EXECUTE FUNCTION financial_policy_guard();
CREATE FUNCTION financial_rule_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE policy_status text; parent_id uuid;
BEGIN
 IF TG_OP='UPDATE' AND NEW."policyVersionId" IS DISTINCT FROM OLD."policyVersionId" THEN RAISE EXCEPTION 'POLICY_RULE_PARENT_IMMUTABLE' USING ERRCODE='55000'; END IF;
 parent_id := CASE WHEN TG_OP='DELETE' THEN OLD."policyVersionId" ELSE NEW."policyVersionId" END;
 IF TG_TABLE_NAME='FeeRule' THEN SELECT status::text INTO policy_status FROM "FeePolicyVersion" WHERE id=parent_id;
 ELSE SELECT status::text INTO policy_status FROM "WithdrawalPolicyVersion" WHERE id=parent_id; END IF;
 IF policy_status IS DISTINCT FROM 'DRAFT' THEN RAISE EXCEPTION 'PUBLISHED_POLICY_IMMUTABLE' USING ERRCODE='55000'; END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER fee_rule_immutable BEFORE INSERT OR UPDATE OR DELETE ON "FeeRule" FOR EACH ROW EXECUTE FUNCTION financial_rule_guard();
CREATE TRIGGER withdrawal_rule_immutable BEFORE INSERT OR UPDATE OR DELETE ON "WithdrawalPolicyRule" FOR EACH ROW EXECUTE FUNCTION financial_rule_guard();

CREATE FUNCTION financial_policy_no_overlap() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE conflicts integer;
BEGIN
 IF NEW.status::text NOT IN ('ACTIVE','SCHEDULED') THEN RETURN NEW; END IF;
 IF TG_TABLE_NAME='FeePolicyVersion' THEN SELECT count(*) INTO conflicts FROM "FeePolicyVersion" p WHERE p.id<>NEW.id AND p.status::text IN ('ACTIVE','SCHEDULED') AND tstzrange(p."effectiveFrom",p."effectiveTo",'[)') && tstzrange(NEW."effectiveFrom",NEW."effectiveTo",'[)');
 ELSE SELECT count(*) INTO conflicts FROM "WithdrawalPolicyVersion" p WHERE p.id<>NEW.id AND p.status::text IN ('ACTIVE','SCHEDULED') AND tstzrange(p."effectiveFrom",p."effectiveTo",'[)') && tstzrange(NEW."effectiveFrom",NEW."effectiveTo",'[)'); END IF;
 IF conflicts>0 THEN RAISE EXCEPTION 'POLICY_EFFECTIVE_PERIOD_CONFLICT' USING ERRCODE='23P01'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER fee_policy_no_overlap BEFORE INSERT OR UPDATE ON "FeePolicyVersion" FOR EACH ROW EXECUTE FUNCTION financial_policy_no_overlap();
CREATE TRIGGER withdrawal_policy_no_overlap BEFORE INSERT OR UPDATE ON "WithdrawalPolicyVersion" FOR EACH ROW EXECUTE FUNCTION financial_policy_no_overlap();
