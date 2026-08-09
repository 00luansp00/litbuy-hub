# Seller hold release eligibility

`SellerHoldEligibilityService` is the internal PR #53 primitive that changes a valid
`DELIVERY_PROTECTION` hold from `ACTIVE` to `RELEASE_ELIGIBLE` when PostgreSQL
`transaction_timestamp()` reaches its immutable `releaseEligibleAt` snapshot. It offers
single-item and bounded batch processing; no endpoint or scheduler invokes it.

The service revalidates the completed, paid, confirmed, undisputed order; its single paid BRL
payment; immutable order proceeds; the historical release rule and frozen delay formula; and
the unique original `SELLER_FUNDS_HELD` posting. It never resolves the currently effective
policy. Retiring the historical version or publishing another version does not change a hold.
Legacy or partial snapshots and inconsistent artifacts fail closed into a deduplicated
`SellerHoldEligibility` reconciliation issue. Expected disputes and deadlines not yet reached
are business blocks without reconciliation.

`RELEASE_ELIGIBLE` means only that the protection deadline elapsed. All money remains in
`SELLER_HELD`; `releaseEligibleAt` is not an available balance and `releasedAt` remains null.
This phase creates no ledger entry, event, settlement, withdrawal, reserved balance, PSP call,
public endpoint, scheduler, production policy seed, or `SELLER_HELD -> SELLER_AVAILABLE`
movement.

PostgreSQL enforces the monotonic lifecycle: a delivery-protection hold is inserted `ACTIVE`,
may transition only to `RELEASE_ELIGIBLE`, and can never return to `ACTIVE`. A replay returns
`ALREADY_ELIGIBLE` only after the frozen snapshot, historical rule, order/payment correlations,
and original posting have been validated again; the historical policy may be `RETIRED`.

## Downstream monetary release

Eligibility remains non-monetary. A separately identified internal operation revalidates the frozen snapshot and moves `SELLER_HELD` to `SELLER_AVAILABLE` atomically with `RELEASED`; see `SELLER_HELD_FUNDS_RELEASE.md`.
