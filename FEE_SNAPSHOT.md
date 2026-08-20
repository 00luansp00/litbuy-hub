# Composite Fee Snapshot (H2)

## CURRENT implementation

H2 distinguishes historical flat snapshots from prospective composite snapshots explicitly. `Order.feeSnapshotVersion = NULL` means a legacy Order and preserves the existing `feePolicyVersionId`, `platformCommissionRuleId`, `pricingPolicyVersion`, and `platformFeeAmountMinor` compatibility surface. The migration performs no economic backfill. A checkout created after H2 sets version `1` and atomically inserts one relational `OrderFeeComponentSnapshot`.

Version 1 currently permits and materializes only `LISTING_TIER`. Its typed row freezes the policy and rule identifiers, public policy version, applied SILVER/GOLD/DIAMOND tier, category, charged party, formula, percent basis points, calculation base, resulting amount, currency, and creation time. Seller MAX and Buyer VIP are not active component kinds in H2.

## Database authority and immutability

PostgreSQL foreign keys retain historical policy/rule identity with `ON DELETE RESTRICT`, including a composite rule-to-policy key. Checks and insertion validation require exactly the same canonical Listing Tier rule shape as H1: enabled `PLATFORM_COMMISSION`, charged to `SELLER`, `PERCENT_BPS`, exact tier, and no fixed/minimum/maximum or payment/installment/seller/withdrawal/product qualifiers. They also require nonnegative rate/base/amount, exact rule rate, exact policy public version, deterministic basis-point result, and equality with the parent compatibility snapshot. One component per Order/kind is unique.

The marker and every component field are immutable. A deferred constraint trigger requires exactly one Listing Tier component at transaction commit for a version-1 Order, allowing Order and component creation in the same transaction while rejecting partial commits. A legacy Order cannot be upgraded by UPDATE.

## Checkout, replay, and concurrency

Checkout retains its advisory idempotency, cart, and stock locks and the effective `FeePolicyVersion FOR SHARE`. Policy resolution, the single integer calculation, Order creation, component materialization, and normal commerce artifacts remain in the same transaction. Failure rolls everything back. Buyer total remains the subtotal; Listing Tier is Seller-charged.

A completed idempotency replay returns its persisted response before policy resolution, so it neither re-rates nor creates another component. A later independent checkout may resolve a later effective policy without changing the earlier snapshot.

## Financial recognition

Legacy Orders (`feeSnapshotVersion IS NULL`) retain flat-snapshot validation. For version 1, sale recognition additionally requires exactly one coherent Listing Tier component and validates its frozen policy/rule/version/tier/rate/base/amount without consulting an active policy or recalculating from a current policy. Missing or inconsistent H2 evidence fails closed, deduplicates a `ReconciliationIssue`, and creates no `SALE_RECOGNIZED` transaction or ledger entry. Valid H2 evidence preserves existing ledger economics.

## Future boundaries

H2 persists the evidence a future refund capability will need, but implements no refund, reversal, PSP expense, recovery, deficit, payout, or withdrawal behavior. Seller MAX and Buyer VIP remain separate future capabilities; extending the component enum and rules requires their own migrations and contracts. H2 adds no commercial rate constants: rates continue to come from versioned `FeeRule` rows.
