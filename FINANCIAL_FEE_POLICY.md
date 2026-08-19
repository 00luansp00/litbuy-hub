# Versioned financial fee policy

> **OWNER TARGET / NOT IMPLEMENTED (2026-08-18):** the freeze defines configurable initial baselines for tiers, MAX, VIP and proportional reversal of LIT Buy fees. The foundation/no-production-seed statements below remain CURRENT; values are not runtime hardcode.


> **Integração de checkout (PR #47):** a comissão geral `PLATFORM_COMMISSION`, cobrada do `SELLER`, agora é resolvida e congelada transacionalmente no pedido. Ausência de política efetiva ou regra aplicável falha fechada; zero exige regra explícita. Consulte `CHECKOUT_PLATFORM_COMMISSION_SNAPSHOT.md`. O reconhecimento no ledger permanece fora deste incremento.

`FeePolicyVersion` and typed `FeeRule` make future administration code-independent without allowing executable JSON/scripts. Drafts alone are editable. Scheduled/active/retired versions and their rules are database-protected from mutation; overlapping scheduled/active effective intervals are rejected. Resolution at a transaction instant must return exactly one version, whose calculated values are snapshotted on the future operation. Old Orders, Payments, ledger postings, commissions, and Withdrawals are never recalculated.

Rules support fixed minor units, integer basis points, and basis points plus fixed, with integer min/max. Typed qualifiers cover payment method and installments, seller level/plan, promotion tier, withdrawal speed, product type, and charged party. Categories cover platform commission, buyer service fee/benefit, payment/card/installment/Pix/boleto charges, promotion, LIT-MAX, seller adjustments, and withdrawals. No production percentage or plan price is defined here.

Frontend Bronze/Prata/Ouro/Diamante/Elite percentages, release times, `/taxas`, payment-method fees, and plan prices remain visual mocks and are not seeded policies. `PSP_FEE_EXPENSE` records a reconciled external PSP cost; a `FeeRule` is LIT Buy commercial policy. Neither proves the other.

Future admin can create/diff/schedule/publish/retire versions and configure benefits, commissions, methods, levels, plans, promotions, withdrawal fees/SLA, and instant enablement. Publication requires ADMIN, step-up/2FA, actor, timestamp, audit, and idempotency.

## Deterministic rule resolution

A null qualifier is general. Applicable rules must match the charged party and every non-null qualifier. Resolution uses highest numeric priority and then greatest qualifier specificity; database return order is irrelevant. More than one equally ranked winner fails with stable `FEE_RULE_AMBIGUOUS` rather than silently selecting a rule. Formula components, non-negative values, min/max, and installment ranges are validated in TypeScript and PostgreSQL.
