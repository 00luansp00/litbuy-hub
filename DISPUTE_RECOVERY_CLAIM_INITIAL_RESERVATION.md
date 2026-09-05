# AA0.2 — Recovery claim and initial AVAILABLE reservation

## Authorities and amount

AA0.2 preserves the authority chain `DisputeCase → DisputeFinancialDecision (AA0) → DisputeSellerLiability (AA0.1) → DisputeRecoveryClaim → DisputeRecoveryReservation → Ledger`. The immutable claim copies its amount exclusively from `sellerLiabilityAmountMinor`; parties, order, currency and priority are server-derived and PostgreSQL-validated. A zero Seller liability is an explicit no-op and creates neither claim nor posting.

The immutable reservation is the only attribution of aggregate `SELLER_RESERVED` to a claim. Therefore `reservedAmountMinor = SUM(DisputeRecoveryReservation.amountMinor)` and `unfundedAmountMinor = claimAmountMinor - reservedAmountMinor`; neither is a mutable claim balance or status. Existing unrelated RESERVED is never co-opted.

## FIFO, segregation and locking

FIFO is per Seller and is ordered by the AA0 authority `(DisputeFinancialDecision.executableAt, DisputeFinancialDecision.id)`, never claim creation or processor call time. Calling the processor for a newer liability materializes and considers every positive Seller liability, including older liabilities without claims.

The transaction uses `SellerProfile FOR UPDATE` as the common serialization boundary. Its lock order is Seller row, FIFO authorities/claims, then the canonical Ledger service's idempotency/account locks. Seller accounts are provisioned before entering that boundary. SERIALIZABLE transactions retry recognized conflicts three times. Database insertion guards also lock the Seller row and reject funding a later claim while an earlier positive liability is absent or unfunded.

## Initial funding

This slice scans only legitimate BRL `SELLER_AVAILABLE`. A positive amount posts canonically and atomically as:

- debit `SELLER_AVAILABLE`;
- credit `SELLER_RESERVED`;
- type `DISPUTE_RECOVERY_RESERVED`;
- `referenceType=DisputeRecoveryClaim`, `referenceId=claim.id`;
- stable identity `SHA-256(dispute-recovery-reservation:<claim-id>:initial-available)`.

The posting, entries, financial event, outbox event and allocation share one transaction. PostgreSQL validates the exact two-entry shape, Seller, amount, currency, type and reference, enforces cumulative funding, append-only authorities and a deferred posting-to-allocation link.

Partial and zero funding remain valid. `SELLER_PENDING`, `SELLER_HELD`, unrelated `SELLER_RESERVED`, `SELLER_DEFICIT`, platform commission, fee snapshots, Refund and Buyer state are not used or changed.

## Deliberate boundary

Unfunded claim value is **not** a `SELLER_DEFICIT` posting. No approved accounting counterparty exists for that posting: neither `PROVIDER_CLEARING` nor `BUYER_REFUND_CLEARING` may be selected by convenience. There is no Buyer wallet, payout, PSP refund, Seller top-up, new-sale amortization, fee-reversal posting, endpoint, cron or external consumer in AA0.2. AA1 must define the deficit accounting authority; later capabilities must add approved funding sources and human-authorized recovery execution.
