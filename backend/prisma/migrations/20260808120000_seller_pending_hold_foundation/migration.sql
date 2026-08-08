ALTER TABLE "FinancialHold"
  ADD COLUMN "orderId" UUID,
  ADD COLUMN "ledgerTransactionId" UUID;
ALTER TABLE "FinancialHold" ADD CONSTRAINT "FinancialHold_order_seller_fkey"
  FOREIGN KEY ("orderId", "sellerProfileId") REFERENCES "Order"("id", "sellerProfileId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinancialHold" ADD CONSTRAINT "FinancialHold_payment_order_fkey"
  FOREIGN KEY ("paymentId", "orderId") REFERENCES "Payment"("id", "orderId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinancialHold" ADD CONSTRAINT "FinancialHold_ledgerTransactionId_fkey"
  FOREIGN KEY ("ledgerTransactionId") REFERENCES "LedgerTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "FinancialHold_ledgerTransactionId_key" ON "FinancialHold"("ledgerTransactionId");
CREATE INDEX "FinancialHold_orderId_reason_idx" ON "FinancialHold"("orderId", "reason");
CREATE UNIQUE INDEX "FinancialHold_delivery_protection_order_unique"
  ON "FinancialHold"("orderId") WHERE "orderId" IS NOT NULL AND "reason" = 'DELIVERY_PROTECTION';

CREATE TABLE "SellerPendingHoldZero" (
  "orderId" UUID NOT NULL,
  "paymentId" UUID NOT NULL,
  "sellerProfileId" UUID NOT NULL,
  "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SellerPendingHoldZero_pkey" PRIMARY KEY ("orderId"),
  CONSTRAINT "SellerPendingHoldZero_order_seller_fkey" FOREIGN KEY ("orderId", "sellerProfileId")
    REFERENCES "Order"("id", "sellerProfileId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "SellerPendingHoldZero_payment_order_fkey" FOREIGN KEY ("paymentId", "orderId")
    REFERENCES "Payment"("id", "orderId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "SellerPendingHoldZero_sellerProfileId_fkey" FOREIGN KEY ("sellerProfileId")
    REFERENCES "SellerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SellerPendingHoldZero_paymentId_key" ON "SellerPendingHoldZero"("paymentId");
CREATE INDEX "SellerPendingHoldZero_sellerProfileId_idx" ON "SellerPendingHoldZero"("sellerProfileId");

CREATE UNIQUE INDEX "LedgerTransaction_seller_funds_held_order_unique"
  ON "LedgerTransaction"("referenceId")
  WHERE "type" = 'SELLER_FUNDS_HELD' AND "referenceType" = 'OrderSellerHold';
