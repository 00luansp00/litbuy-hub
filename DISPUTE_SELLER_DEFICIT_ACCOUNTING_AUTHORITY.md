# AA1 — Seller deficit accounting authority

## Current capability

AA1 extends the existing chain `DisputeCase → DisputeFinancialDecision → DisputeSellerLiability → DisputeRecoveryClaim → initial reservation → deficit origination → Ledger`. It recognizes only the claim value left unfunded by AA0.2's one-time initial `SELLER_AVAILABLE` allocation.

The server derives `initialReservedAmountMinor = SUM(DisputeRecoveryReservation.amountMinor)` and `originatedDeficitAmountMinor = claimAmountMinor - initialReservedAmountMinor`. A fully funded claim is a no-op. Positive partial or entirely unfunded claims are originated once in BRL as exactly:

- debit `SELLER_DEFICIT` (ASSET, SELLER owner, the claim's Seller);
- credit `RECOVERY_CLAIM_OBLIGATION` (LIABILITY, SYSTEM owner, account-per-claim).

The transaction type is `DISPUTE_SELLER_DEFICIT_RECOGNIZED`, with `referenceType=DisputeRecoveryClaim` and `referenceId=claim.id`. This obligation identifies the Buyer claim's economic beneficiary; it is not a Buyer wallet, available balance, payout authorization, refund, PSP refund, recovered money, or promise of immediate payment.

## Structural authority and idempotency

Each obligation account has `ownerId=claim.id` and a one-to-one relational binding to its claim. A separate immutable origination binds claim, Seller, obligation account, positive amount, BRL currency, and Ledger transaction. Unique keys prevent a second binding, account reuse, transaction reuse, or second initial origination.

The stable identity is `SHA-256("dispute-seller-deficit:" + claim.id + ":initial-unfunded:v1")`. Canonical Ledger request hashing fails closed on a divergent replay. No mutable remaining/current deficit exists; Seller deficit remains derived exclusively from Ledger entries.

## Concurrency and PostgreSQL defenses

The real lock order remains: provision Seller accounts before the queue; lock `SellerProfile FOR UPDATE`; read/materialize FIFO authorities and initial reservations; then take canonical Ledger idempotency/account locks. The transaction is `SERIALIZABLE`, with three attempts only for recognized serialization conflicts.

PostgreSQL checks the claim-derived amount, Seller, currency, identity, exact type/reference, exact two-entry shape, directions, account ownership/class/purpose, and matching amount. Foreign keys and unique constraints protect every correlation. Deferred constraint triggers permit the canonical posting-before-origination sequence but reject orphan postings, obligation accounts, bindings, or originations at commit. New authorities and bound obligation accounts reject `UPDATE` and `DELETE`.

## Deliberate boundaries

AA1 does not implement Buyer wallet/balance/payout, payout execution, refund or PSP refund, Seller top-up, Pix, later AVAILABLE consumption, new-sale amortization, fee reversal, withdrawal, Admin recovery authorization, scheduler/worker/endpoint/frontend/notifications, provider reconciliation, or chargeback expansion. It does not claim production readiness. Future recovery funding and delivery to the Buyer remain `NOT_IMPLEMENTED`.
