# Seller hold release-policy snapshot

> **CURRENT IMPLEMENTATION (PR F):** policy is frozen at checkout for new Orders and the normal clock of every new positive-proceeds delivery-protection hold starts at authoritative `OrderDelivery.createdAt`. Legacy all-NULL Order snapshots retain DEFAULT policy resolution but use the same delivery clock. Seller MAX and G1/G2 remain not implemented.

The immutable snapshot is the sole temporal authority used by the PR #53 eligibility phase;
the current effective policy is never consulted and a retired historical policy remains valid.

`SellerPendingHoldService` validates exactly one seller-coherent delivery inside the same SERIALIZABLE transaction that validates the order and payment, posts `SELLER_PENDING -> SELLER_HELD`, and creates a new delivery-protection hold. It materializes `releasePolicyAppliedAt = OrderDelivery.createdAt` and `releaseEligibleAt = OrderDelivery.createdAt + frozen delayHours` at `TIMESTAMP(3)` precision. Missing, inconsistent, or structurally invalid delivery clocks fail closed without a partial hold posting. Buyer confirmation does not recalculate this schedule.

The migration does not update historical `FinancialHold` rows. Existing complete snapshots remain immutable and idempotent. Zero proceeds retain `SellerPendingHoldZero` without inventing a monetary hold. The operational candidate gates remain `COMPLETED`/PAID/CONFIRMED; removing target blockers and changing release execution belongs to G1/G2.

A valid PR #50 hold whose five snapshot fields are all null is a supported legacy artifact. Its first successful processing locks and validates the existing order, payment, posting, hold, and authoritative delivery, then resolves the currently effective DEFAULT policy and schedules the hold from `OrderDelivery.createdAt`. It creates no additional ledger transaction, entry, financial event, or outbox event. After the all-null-to-complete transition, a PostgreSQL trigger makes the snapshot immutable; later policies never rewrite historical holds.

The four new seller-release-policy fields are exclusive to delivery protection, while `releaseEligibleAt` remains a generic `FinancialHold` field for other hold reasons. On initial application PostgreSQL proves that the enabled default rule belongs to the recorded ACTIVE/effective version and that its delay equals the frozen delay. Missing or ambiguous policy resolution fails closed and creates a deduplicated `SellerPendingHold` reconciliation issue. Operators must explicitly resolve that issue after correcting policy configuration. Zero seller proceeds require no policy because there is no held money; `SellerPendingHoldZero` remains the durable marker.

This increment only schedules eligibility. A hold remains `ACTIVE`, including when its delay is zero, and `releasedAt` remains null. Retirement after application does not alter the immutable historical rule, delay, or timestamps. `releaseEligibleAt` does not mean that the seller balance is available. There is no `SELLER_HELD -> SELLER_AVAILABLE` posting, reserved balance, withdrawal, PSP call, scheduler, timer, or production policy seed. No production policy is seeded; the Owner initial DEFAULT baseline is 7 days, while numbers used by tests remain fixtures only.

## Owner target snapshot evolution — NOT IMPLEMENTED

The current snapshot above truthfully records a global policy applied during hold creation. The Owner target in `DISPUTE_FINANCIAL_RECOVERY_CONTRACT.md` instead resolves and freezes the applicable hierarchical rule at checkout, including authoritative category/subcategory, policy version, selected source (`SUBCATEGORY`, `CATEGORY`, or `DEFAULT`) and base delay. The hierarchy is now implemented in the resolver, but this checkout snapshot is not. The current Owner target starts its financial clock at authoritative `deliveredAt`; only a future Seller MAX capability may anticipate release. Later Admin changes never rewrite an earlier Order. These semantics require future design/implementation and are not claims about current code.
# Checkout policy authority — CURRENT

Para Orders novos, o `FinancialHold` herda version, rule e delay do snapshot imutável do Order,
inclusive quando a policy foi aposentada depois do checkout. Eligibility e release validam a
identidade do hold contra o Order e aceitam scopes CATEGORY/SUBCATEGORY. Para Order legado com
snapshot totalmente NULL, permanece a validação DEFAULT/effective-at-hold-time anterior.

Esta evolução não muda os gates COMPLETED/PAID/CONFIRMED, blockers, cálculo de due, transições
do ledger ou o relógio CURRENT baseado no momento de criação do hold. `deliveredAt` permanece
fora desta capability.
