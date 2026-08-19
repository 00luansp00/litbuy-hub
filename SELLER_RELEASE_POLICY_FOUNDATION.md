# Seller release policy foundation

> **CURRENT IMPLEMENTATION (PR F):** policy resolution is hierarchical (`SUBCATEGORY > CATEGORY > DEFAULT`), new Orders freeze it at checkout, and new holds start at immutable `OrderDelivery.createdAt`. Legacy all-NULL Orders intentionally resolve DEFAULT while using the same authoritative delivery clock.

## Version and lifecycle

`SellerReleasePolicyVersion` retains its `DRAFT`, `SCHEDULED`, `ACTIVE`, and `RETIRED` lifecycle and publication audit metadata. DRAFT may move directly to a later state, SCHEDULED may become ACTIVE or RETIRED, and ACTIVE may become RETIRED. After DRAFT, version identity, effective window, creator, creation time, publication metadata, and rules are immutable. A correction is a new public version, never a historical edit. Overlapping SCHEDULED/ACTIVE publication remains serialized and rejected by PostgreSQL.

## Hierarchical rules

Every `SellerReleasePolicyRule` has an explicit scope and stable catalog qualifier:

- `DEFAULT` has neither category nor subcategory;
- `CATEGORY` references exactly one `CatalogCategory.id`;
- `SUBCATEGORY` references exactly one `CatalogSubcategory.id`.

PostgreSQL CHECK constraints enforce these shapes, foreign keys preserve catalog identity, and partial unique indexes permit at most one rule for each scope/qualifier in a policy version. Names, slugs, labels, and commercial strings never participate in financial resolution. `delayHours` remains a non-null, nonnegative integer. Overrides may be shorter than, equal to, or longer than DEFAULT.

The resolver selects the single effective ACTIVE version using PostgreSQL `transaction_timestamp()`, then applies explicit precedence among enabled matching rules: `SUBCATEGORY`, then `CATEGORY`, then `DEFAULT`. A disabled specific rule is skipped. A call without classification considers only DEFAULT, preserving the legacy all-NULL Order path without guessing a product classification. Missing policy or missing applicable rule raises `SELLER_RELEASE_POLICY_NOT_FOUND`; structurally ambiguous state raises `SELLER_RELEASE_POLICY_AMBIGUOUS`. Resolution is read-only.

## Configuration baseline and fail-closed behavior

The Owner initial DEFAULT baseline is **7 days (168 hours)**, but it is a value for a future published configuration, not a resolver constant or production seed. No policy actor is invented and this increment creates no production policy. An empty database, a database without an effective published policy, or a policy without an applicable enabled rule fails closed. The Owner's initial 4-day commercial groups are likewise not mapped by label or invented UUID; the schema only supplies ID-backed override capability.

Generic per-rule acceleration, rating-based acceleration, and a 50% reduction are superseded targets and are not part of this policy. Only Seller MAX may anticipate release in a future capability.

## Legacy migration

Existing `DELIVERY_PROTECTION_DEFAULT` rules are deterministically backfilled as `DEFAULT` without changing IDs, delays, versions, publication windows, or audit history. Migration aborts if it encounters any other legacy rule code, rather than assigning an unauthorized financial meaning. Published-rule runtime immutability remains enabled after the controlled backfill.

## Historical PR D boundary — superseded by PR #110 / PR F

At the PR D cut, `SellerPendingHoldService` consumed only DEFAULT inside hold creation; checkout did not resolve policy, Order had no frozen policy fields, and the clock had not moved to `deliveredAt`. This statement is retained as historical evidence and is not CURRENT after PR #110 and PR F.

## Current boundary — PR #110 / PR F

The hierarchy is implemented and new Orders freeze the selected version, rule, source, classification, and base delay at checkout. New delivery-protection holds consume that frozen policy and use authoritative `OrderDelivery.createdAt`; legacy all-NULL Orders retain DEFAULT policy resolution with the same delivery-clock authority. The `COMPLETED`/PAID/CONFIRMED gates and the broader eligibility/execution changes remain separate G1/G2 capabilities. Seller MAX, dispute core, recovery, refund, withdrawal, settlement, PSP, VIP, LIT Points, and Admin UI remain outside this boundary.
# RELEASE-CHECKOUT-SNAPSHOT — CURRENT IMPLEMENTATION

Além da hierarquia já implementada, o checkout resolve a policy com `Product.categoryId` e
`Product.subcategoryId` dentro da mesma transação e congela version, rule, source, classificação
e delay no `Order`. A classificação congelada é a do produto, não os qualifiers possivelmente
nulos da rule DEFAULT. Novas publicações não alteram Orders existentes.

Orders legados permanecem com todos os campos de snapshot NULL e seguem o resolver DEFAULT
histórico no processamento do hold. Não existe backfill. Após PR F, o relógio de novo hold usa
`releasePolicyAppliedAt = OrderDelivery.createdAt` e `releaseEligibleAt = deliveredAt + delay`.
Confirmação Buyer posterior não reinicia o relógio; gates completos de eligibility/execution permanecem G1/G2.
