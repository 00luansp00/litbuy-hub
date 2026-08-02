# Versioned financial fee policy

`FeePolicyVersion` and typed `FeeRule` make future administration code-independent without allowing executable JSON/scripts. Drafts alone are editable. Scheduled/active/retired versions and their rules are database-protected from mutation; overlapping scheduled/active effective intervals are rejected. Resolution at a transaction instant must return exactly one version, whose calculated values are snapshotted on the future operation. Old Orders, Payments, ledger postings, commissions, and Withdrawals are never recalculated.

Rules support fixed minor units, integer basis points, and basis points plus fixed, with integer min/max. Typed qualifiers cover payment method and installments, seller level/plan, promotion tier, withdrawal speed, product type, and charged party. Categories cover platform commission, buyer service fee/benefit, payment/card/installment/Pix/boleto charges, promotion, LIT-MAX, seller adjustments, and withdrawals. No production percentage or plan price is defined here.

Frontend Bronze/Prata/Ouro/Diamante/Elite percentages, release times, `/taxas`, payment-method fees, and plan prices remain visual mocks and are not seeded policies. `PSP_FEE_EXPENSE` records a reconciled external PSP cost; a `FeeRule` is LIT Buy commercial policy. Neither proves the other.

Future admin can create/diff/schedule/publish/retire versions and configure benefits, commissions, methods, levels, plans, promotions, withdrawal fees/SLA, and instant enablement. Publication requires ADMIN, step-up/2FA, actor, timestamp, audit, and idempotency.
