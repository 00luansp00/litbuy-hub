# Seller MAX release calculation (K)

> **CURRENT IMPLEMENTATION:** K v1 is a prospective, server-side and persistent calculation. Historical Orders are not backfilled. This document is implementation evidence, not a rewrite of Owner decisions or historical audit evidence.

For each new delivered `LIT_MAX` Order with a frozen release delay, `Order` stores `sellerMaxReleaseCalculationVersion=1`, `sellerMaxReleaseReductionHours`, `sellerMaxReleaseTargetAt`, and later the terminal `sellerMaxEffectiveReleaseAt`. `FinancialHold.releaseEligibleAt` remains the immutable **base** deadline. The K snapshot is independent of the current Product, listing, fee policy, rating, and active release policy.

## Owner formula and hours mapping

CURRENT stores hours, so complete seven-day blocks are `blocks=floor(frozenBaseReleaseDelayHours/168)`. K v1 uses `reductionHours=blocks*48`, `base=deliveredAt+delayHours`, `target=deliveredAt+(delayHours-reductionHours)`, and, for a structurally valid J `QUALIFIED`, `effective=MIN(base, MAX(target,buyerConfirmedAt))`. This exact-duration mapping preserves `TIMESTAMP(3)` and does not round to calendar days. It structurally guarantees `effective <= base`.

Examples (base days → target days): 4→4, 6→6, 7→5, 10→8, 13→11, 14→10, 20→16, and 21→15. Hour boundaries 0/167/168/169/335/336/504 produce reductions 0/0/48/48/48/96/144 hours.

## Lifecycle and authority

Delivery initializes K only prospectively for `Order.sellerPlanSnapshot=LIT_MAX`. J `PENDING` keeps effective NULL and financial consumers use base. `QUALIFIED` freezes the MIN/MAX result; `EXPIRED`, including late confirmation, freezes base. STANDARD, legacy all-NULL K, and MAX Orders predating K use base. A hold can therefore be created before or after the J decision without changing the result. Current Product or policy changes never rerate the snapshot.

G1 candidate selection observes the persisted effective timestamp and `processOne` revalidates K under its serializable transaction while retaining all historical base-hold checks. G2 independently revalidates the same effective boundary for execution and replay. Invalid partial/unknown/incorrect K fails closed to reconciliation; it is not treated as legacy. Dispute blockers continue to prevail. Replay is idempotent and cannot mutate K or duplicate the release posting.

PostgreSQL constraints and a trigger enforce the nullable legacy shape, v1/MAX/J relationship, complete-block reduction, exact delivery-derived target, terminal formulas, never-delay rule, and immutability. The migration performs no backfill.

K changes timing only: ledger amount, currency, Seller, double entry, zero-proceeds behavior, and idempotency are unchanged. Withdrawal, payout, PSP, KYC, AK/AK2, Buyer VIP, LitPoints, refund, dispute core, recovery, notifications, and Product Q&A are outside this capability.
