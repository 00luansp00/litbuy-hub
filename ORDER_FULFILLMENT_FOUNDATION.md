# Authoritative order fulfillment foundation

## Scope and state machine

This backend increment owns the commercial transitions after paid-order activation:

`ACTIVE + PAID + NOT_AVAILABLE → AWAITING_SELLER → DELIVERED → AWAITING_BUYER_CONFIRMATION → CONFIRMED`, followed by `ACTIVE → COMPLETED`.

Availability, the move to buyer confirmation, and completion are system actions. Only the seller profile that owns the order may record delivery; only the order buyer may explicitly confirm receipt. Foreign orders are hidden with the existing IDOR-safe not-found behavior. `OPEN` or `UNDER_REVIEW` disputes block progression.

## Evidence boundary

`OrderDelivery` is an auditable boundary, not a secret vault. It stores one delivery row per order, the authoritative seller profile, a neutral reference type, and a mandatory SHA-256 evidence digest. `secureReference` is reserved for a future trusted internal subsystem and is not accepted by the public API. Delivery content, credentials, passwords, activation codes, license keys, tokens, arbitrary URLs, PSP data, and unnecessary PII must never be stored in this row or event metadata.

`AUTOMATED_REFERENCE` does not perform or simulate automatic delivery. There is no production-ready credential/key delivery channel in this increment; both delivery types require real evidence from a supported mechanism.

## Completion contract

Buyer confirmation is explicit. This increment deliberately defines no timeout, cron, timer, or commercial deadline. Completion requires an active, paid, confirmed, undisputed order, a persisted delivery, and exactly one valid `SALE_RECOGNIZED` ledger transaction for `OrderSale/<order id>` with the PR #48 idempotency key. Missing or invalid recognition fails closed and opens a deduplicated `OrderFulfillment` reconciliation issue; fulfillment never creates financial recognition.

Each effective edge increments `Order.version` exactly once and creates one transactional `OrderEvent` plus one `OutboxEvent`: `fulfillment.available`, `fulfillment.delivered`, `fulfillment.awaiting_buyer_confirmation`, `fulfillment.confirmed`, and `order.completed`. Per-order advisory transaction locks plus the unique delivery/order constraint serialize concurrent workers and make replay idempotent.

## Financial non-goals

No ledger transaction, entry, financial event/outbox, settlement, hold, withdrawal, PSP call, or balance movement is created here. In particular, seller proceeds remain exclusively `SELLER_PENDING`; there is no move to `SELLER_AVAILABLE` or `SELLER_HELD`. The next financial-release increment consumes `CONFIRMED/COMPLETED`.

## Completion recovery and reconciliation

System inconsistencies are recorded inside the locked transaction and returned as explicit outcomes; the transaction commits before a public operation converts that outcome to a conflict response. Active `OrderFulfillment` reconciliation issues block automatic completion retries. After an operator explicitly resolves an issue, `processCompletionBatch()` may safely reconsider an `ACTIVE + CONFIRMED + PAID` order; it never resolves or deletes the historical issue itself. Exact buyer and seller replays remain side-effect free, while a delivery replay with a changed type or evidence hash is rejected as an idempotency mismatch.
