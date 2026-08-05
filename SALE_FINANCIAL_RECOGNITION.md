# Sale financial recognition

This increment recognizes an already paid and activated sale in the internal double-entry ledger. It does not release seller funds.

## Preconditions

A candidate order must be `ACTIVE`, have `paymentStatus = PAID`, and have exactly one local `Payment` that is `PAID`, has `paidAt`, uses `BRL`, and matches the order total. The payment must have exactly one legitimate `PaymentAttempt` in `SUCCEEDED` status with matching amount/currency, a non-empty provider code, and an external payment identifier.

Orders with an open or investigating `ReconciliationIssue` for `SaleFinancialRecognition` are skipped by batch selection to avoid a busy loop. A resolved issue allows the order to be evaluated again.

## Order snapshot authority

The immutable order pricing snapshot is the only commission authority:

- `Order.totalAmountMinor` is the gross amount.
- `Order.platformFeeAmountMinor` is the platform commission.
- `sellerProceedsMinor = totalAmountMinor - platformFeeAmountMinor`.
- `feePolicyVersionId`, `platformCommissionRuleId`, and `pricingPolicyVersion` are validated for referential integrity.

The service never recalculates commission, never calls fee calculation/resolution, and never requires the referenced policy to still be `ACTIVE`. A retired policy remains valid for historical recognition.

Legacy active/paid orders without the pricing snapshot fail closed with `ORDER_PRICING_SNAPSHOT_MISSING`; no zero-fee fallback is inferred.

## Posting

`SaleFinancialRecognitionService` delegates all posting to `FinancialLedgerService.post()` with `emitOutbox = true`. It does not write `LedgerTransaction` or `LedgerEntry` directly.

For a normal sale, the posting is:

- DR `SYSTEM / PROVIDER_CLEARING` for `grossAmountMinor`.
- CR `SELLER / SELLER_PENDING` for `sellerProceedsMinor`.
- CR `PLATFORM / PLATFORM_COMMISSION` for `platformCommissionMinor`.

Zero-value entries are omitted because ledger entries require positive amounts. A zero commission posts only provider clearing debit and seller pending credit. A commission equal to the order total posts only provider clearing debit and platform commission credit.

The seller remains pending. This PR intentionally creates no movement to `SELLER_HELD`, `SELLER_AVAILABLE`, or `SELLER_RESERVED`.

## Idempotency, event, and outbox

The idempotency hash is deterministic: `sha256("sale-recognition:v1:" + order.id)`. Replays produce the same request. The durable recognition record is the `LedgerTransaction` with:

- `type = SALE_RECOGNIZED`;
- `referenceType = OrderSale`;
- `referenceId = Order.id`.

A successful recognition creates exactly one `LedgerTransaction`, one `FinancialEvent`, and one `FinancialOutboxEvent`. Metadata stores safe identifiers and money values as decimal strings only.

## Reconciliation

Validation failures create a deduplicated open reconciliation issue using:

- `referenceType = SaleFinancialRecognition`;
- `referenceId = Order.id`;
- sanitized details like `{ "errorCode": "PAYMENT_AMOUNT_MISMATCH" }`.

`IDEMPOTENCY_KEY_REUSED` from the ledger is converted to `SALE_LEDGER_IDEMPOTENCY_MISMATCH`. Invalid money fails closed through reconciliation. Unexpected infrastructure errors propagate.

## Boundaries

The service does not call a PSP, Efí, HTTP, frontend data, settlement, financial hold, fulfillment, delivery, disputes, refunds, chargebacks, withdrawals, or operational settlement. Future PRs will move seller amounts from `PENDING` to held or available buckets when the commercial lifecycle supports release.
