# Dispute Seller Deficit Accounting Authority — AA1

## Owner Decision

AA1 recognizes the immutable initial shortfall of a `DisputeRecoveryClaim` with the canonical posting:

```text
DEBIT  SELLER_DEFICIT
CREDIT RECOVERY_CLAIM_OBLIGATION
```

The transaction type is `DISPUTE_SELLER_DEFICIT_RECOGNIZED`. AA0.2 remains the single initial attempt to reserve `SELLER_AVAILABLE`; AA1 neither retries that funding nor redistributes it.

## Economic authority and binding

`SELLER_DEFICIT` remains a Seller-owned `ASSET`, segregated by `sellerProfileId`. Each `RECOVERY_CLAIM_OBLIGATION` is a distinct SYSTEM-owned `LIABILITY`. `RecoveryClaimObligationBinding` provides unique foreign keys in both directions between the account and exactly one claim. The claim remains the authority for Buyer, Seller, order, decision, liability, currency, and FIFO priority.

The Buyer is the economic beneficiary of the restricted recovery obligation. **Beneficiary != available balance != payout authorization.** The obligation is not a Buyer wallet, Buyer balance, payout authorization, Refund, PSP refund, or promise of immediate platform payment.

`PROVIDER_CLEARING`, `BUYER_REFUND_CLEARING`, `SELLER_RESERVED`, revenue, expense, and equity are not valid counterparties.

## Amount and posting

The initial deficit is derived, never supplied by a caller:

```text
initialReservedAmountMinor = SUM(DisputeRecoveryReservation.amountMinor)
originatedDeficitAmountMinor = claimAmountMinor - initialReservedAmountMinor
```

A positive difference creates one `DisputeSellerDeficitOrigination`, one obligation binding, and one Ledger transaction. A fully funded claim creates none. The SHA-256 identity is derived from `dispute-seller-deficit:<claim-id>:initial-unfunded:v1`. Posting uses `FinancialLedgerService.postWithOutcomeInTransaction()` with financial event and outbox in the same SERIALIZABLE transaction.

## Concurrency, immutability, and database defense

Provisioning precedes the existing Seller boundary. AA1 retains the shared `SellerProfile FOR UPDATE` lock, FIFO authority `(executableAt, disputeFinancialDecisionId)`, canonical Ledger idempotency/account locks, and normalized serialization retry behavior.

PostgreSQL foreign keys, unique/check constraints, insert guards, deferred correlation triggers, and append-only triggers enforce claim/account uniqueness; SYSTEM/LIABILITY/BRL obligation shape; Seller/Buyer/amount authority; exactly two canonical entries; correct reference/type; bidirectional transaction/origination correlation; and immutable bindings/originations. Legitimate posting may precede origination inside one transaction because correlation is checked at commit. A failure rolls back Ledger transaction, entries, financial event, outbox, binding, and origination together.

## Deliberate boundaries

AA1 does not change protected Seller buckets beyond AA0.2, and does not create or mutate Payment, Refund, Chargeback, Withdrawal, Order, FinancialHold, provider state, fees, commissions, or Buyer financial state. It adds no endpoint, worker, cron, notification, PSP call, top-up, new-sale funding, amortization, fee reversal, withdrawal enforcement, or Admin authorization.

Future capabilities may credit `SELLER_DEFICIT` through separately authorized top-up, eligible new-sale recovery, or compensation postings. They must derive outstanding balance from the append-only Ledger and prevent over-amortization below zero; AA1 deliberately does not constrain future valid credit transaction types or implement those sources.
