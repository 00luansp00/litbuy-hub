ALTER TABLE "FinancialHold" ADD COLUMN "orderId" UUID;
ALTER TABLE "FinancialHold" ADD CONSTRAINT "FinancialHold_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "FinancialHold_orderId_reason_key" ON "FinancialHold"("orderId", "reason");

CREATE TABLE "SellerPendingHoldZero" (
  "orderId" UUID NOT NULL,
  "paymentId" UUID NOT NULL,
  "sellerProfileId" UUID NOT NULL,
  "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SellerPendingHoldZero_pkey" PRIMARY KEY ("orderId"),
  CONSTRAINT "SellerPendingHoldZero_orderId_fkey" FOREIGN KEY ("orderId")
    REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "SellerPendingHoldZero_paymentId_fkey" FOREIGN KEY ("paymentId")
    REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "SellerPendingHoldZero_sellerProfileId_fkey" FOREIGN KEY ("sellerProfileId")
    REFERENCES "SellerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SellerPendingHoldZero_paymentId_key" ON "SellerPendingHoldZero"("paymentId");
CREATE INDEX "SellerPendingHoldZero_sellerProfileId_idx" ON "SellerPendingHoldZero"("sellerProfileId");

CREATE UNIQUE INDEX "LedgerTransaction_seller_funds_held_order_unique"
  ON "LedgerTransaction"("referenceId")
  WHERE "type" = 'SELLER_FUNDS_HELD' AND "referenceType" = 'OrderSellerHold';
