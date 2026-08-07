CREATE UNIQUE INDEX "LedgerTransaction_sale_recognition_order_unique"
ON "LedgerTransaction" ("referenceId")
WHERE "type" = 'SALE_RECOGNIZED'
  AND "referenceType" = 'OrderSale';
