# AA0.1 — Dispute Seller Liability Decomposition

## Authority and economics

`DisputeFinancialDecision.decidedPrincipalAmountMinor` remains the principal authority; it is never recalculated from the order total. Seller liability is a distinct, immutable authority:

`liability = decided principal - prospective reversal of own Seller-side LIT Buy fees`.

Only frozen `OrderFeeComponentSnapshot` rows are read. `LISTING_TIER` (PRATA, OURO or DIAMANTE) and applicable `SELLER_MAX` are included. `BUYER_VIP` is Buyer-side and is explicitly excluded. PSP fees, taxes, chargebacks and external liabilities are outside this boundary. No current policy is queried or used to rerate an order.

Versions 1, 2 and 3 are validated according to their frozen component shape. A `NULL` fee snapshot version is unresolved legacy `PLATFORM_COMMISSION`; decomposition fails closed with `SELLER_LIABILITY_LEGACY_FEE_UNRESOLVED`, without a mapping or backfill.

## Partial decisions and rounding

All arithmetic uses PostgreSQL `BIGINT`/TypeScript `bigint`. For each frozen Seller component and decision, ordered by `(executableAt, id)`:

`allocation = floor(frozen fee × (prior decided principal + current principal) / original principal) - floor(frozen fee × prior decided principal / original principal)`.

The cumulative method prevents over-allocation and makes the increment that reaches 100% reconcile exactly to the frozen fee. The child rows retain the frozen snapshot FK, kind, original fee and prospective reversal required for audit.

## Integrity and concurrency

The service accepts only a financial-decision id and derives every party, order, currency and amount server-side. It runs at `SERIALIZABLE`, retries recognized serialization failures, returns the existing authority on replay, and uses the `Order FOR UPDATE` row as the sole per-order serialization boundary. No per-order advisory lock is introduced.

PostgreSQL independently validates authority linkage, snapshot shape, allowed Seller component kinds, calculated parent and child amounts, cumulative limits and complete breakdown. Deferred validation requires all expected children. Both tables are append-only, and timestamps are overwritten from the database transaction clock.

## Explicit non-effects and next boundaries

AA0.1 records decomposition only. It creates no ledger transaction/entry/event/outbox event, balance, hold, refund, deficit, payment, payout, recovery funding, reservation or Buyer promise, and changes no Order, Payment or Dispute status. AA1 deficit posting and the complete post-release recovery/queue/FIFO/payout workflow remain separate and pending.
