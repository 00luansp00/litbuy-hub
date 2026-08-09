# Seller held funds release

`RELEASE_ELIGIBLE` is a policy decision and the seller proceeds remain in `SELLER_HELD`. `SellerHeldFundsReleaseService` is the internal primitive that performs the first monetary availability transition for `DELIVERY_PROTECTION` holds.

The operation runs in one PostgreSQL `SERIALIZABLE` transaction. Its lock order is the deterministic release advisory lock, `FinancialHold`, `Order`, `Payment`, then the ledger service's sorted account locks. It deeply revalidates the frozen historical policy rule, order/payment snapshots, original pending-to-held posting, deadline using `transaction_timestamp()`, and any existing release artifact. It never resolves the currently active policy.

The only posting gateway is `FinancialLedgerService.postWithOutcomeInTransaction`: `DR SELLER_HELD / CR SELLER_AVAILABLE`, in BRL, for `FinancialHold.amountMinor`. Its identity is `SELLER_FUNDS_RELEASED / FinancialHoldRelease / <hold id>` and SHA-256 of `seller-held-release:v1:<hold id>`. The posting and `RELEASE_ELIGIBLE -> RELEASED` update are atomic; PostgreSQL writes `releasedAt`, and `releaseLedgerTransactionId` identifies this posting while `ledgerTransactionId` continues identifying the original pending-to-held posting.

For a new release, the order must still be COMPLETED/PAID/CONFIRMED/NONE; an OPEN or UNDER_REVIEW dispute is a normal business block and leaves the hold eligible. A replay instead validates the historical release facts: `releasedAt >= releaseEligibleAt`, the release posting was created no earlier than eligibility, and its database transaction timestamp equals `releasedAt` at millisecond precision. Legitimate later order, payment, or dispute states do not invalidate that history. Invalid, premature, partial, or inconsistent artifacts fail closed into deduplicated reconciliation; insufficient held balance rolls back before its durable issue is recorded.

`SELLER_AVAILABLE` is only an internal ledger bucket. This foundation adds no withdrawal, bank transfer, PSP call, scheduler, endpoint, or frontend.
