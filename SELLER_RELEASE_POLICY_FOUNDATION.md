# Seller release policy foundation

This increment defines the versioned policy that a later hold-lifecycle increment may snapshot. It does not release funds. `WithdrawalPolicyVersion` is deliberately not reused: withdrawal speed, approval, SLA, enablement, and fees govern cash-out, whereas this policy governs the delivery-protection interval before held proceeds may become eligible.

## Version and lifecycle

`SellerReleasePolicyVersion` has its own `DRAFT`, `SCHEDULED`, `ACTIVE`, and `RETIRED` lifecycle and publication audit metadata. The database permits the same established transitions as the financial policies: DRAFT may move directly to any later state, SCHEDULED may become ACTIVE or RETIRED, and ACTIVE may become RETIRED. After DRAFT, version identity, effective window, creator, creation time, publication metadata, and rules are immutable. A correction is a new public version, never a historical edit.

The MVP rule is global. Exactly one enabled rule with code `DELIVERY_PROTECTION_DEFAULT` is required by the resolver. `delayHours` is a non-null integer greater than or equal to zero: it represents the number of hours between an authoritative protection-start event, to be selected by a future increment, and release eligibility. It is stored and resolved only here; no category, plan, product, payment, risk, KYC, or reputation qualifier exists.

## Temporal resolution and safety

PostgreSQL `transaction_timestamp()` is the time authority. The read-only resolver accepts only an ACTIVE version where `effectiveFrom <= transaction_timestamp()` and `effectiveTo` is null or later than that timestamp. No match raises `SELLER_RELEASE_POLICY_NOT_FOUND`; multiple versions or applicable rules raise `SELLER_RELEASE_POLICY_AMBIGUOUS`. It never silently selects a winner. Database checks validate the effective interval and nonnegative delay, triggers enforce lifecycle and immutability, and an advisory transaction lock serializes overlapping SCHEDULED/ACTIVE publication checks.

No real commercial duration has been selected. There is **no production policy seed**; numeric durations in PostgreSQL tests are fixtures only. An empty production database intentionally makes resolution fail closed.

## Explicit boundary

This foundation neither changes nor is consulted by `SellerPendingHoldService`. It does not update `FinancialHold`, its `status`, or `releaseEligibleAt`; it creates no ledger transaction or entry and never moves `SELLER_HELD` to `SELLER_AVAILABLE`. It adds no endpoint, scheduler, PSP operation, settlement, withdrawal, refund, or dispute behavior. The next separately reviewed increment may snapshot the resolved policy onto the hold lifecycle and define the authoritative protection-start event.

## Delivery-hold consumer (PR #52)

`SellerPendingHoldService` now consumes the resolver inside its SERIALIZABLE transaction and freezes the result as specified by `SELLER_HOLD_RELEASE_SNAPSHOT.md`. Resolution remains read-only; the consumer owns the hold snapshot. Neither component releases funds, and no production duration is seeded.
