# Financial domain foundation (PR #39)

## Boundary and invariants

The LIT Buy ledger is the internal accounting source of truth; a future PSP is evidence for external movement. Divergence opens a `ReconciliationIssue` and is never silently repaired. All authoritative money is BRL `BIGINT` minor units in PostgreSQL and TypeScript `bigint`; future JSON exposes canonical decimal strings.

`LedgerTransaction` and `LedgerEntry` implement double entry. A deferred PostgreSQL constraint requires two or more positive entries, one currency, and equal debit/credit totals. Database triggers make transactions, entries, and financial events append-only. Corrections are new compensating transactions. Accounts have no balance column: seller pending, held, available, reserved, and explicit deficit are derived from entries. Protected liability buckets cannot become negative.

`FinancialLedgerService.post` is the only application posting path. It hashes canonical requests, locks an idempotency namespace and sorted account identifiers using transaction advisory locks, checks sufficiency, and atomically creates transaction, entries, event, and optional outbox. Identical retries return the prior posting; changed payloads raise `IDEMPOTENCY_KEY_REUSED`. Database constraints remain authoritative against direct Prisma/SQL access.

The seller remains `SellerProfile`; no parallel seller/merchant/recipient entity exists. `PaymentProviderAccount` is only an external account reference and stores an opaque `secretRef`, never credentials.

## Aggregates

The persistent foundation includes Payment (at most one per Order), attempts, provider accounts, holds, settlements, transfers, withdrawals, refunds, chargebacks, webhook deliveries, reconciliation issues, ledger, events, outbox, and versioned fee/withdrawal policies. `NOT_CREATED` remains only on `Order.paymentStatus`; a real Payment is database-constrained against it. Checkout does not create Payment and no public financial endpoint or UI is introduced.

Webhook delivery is at-least-once. `(providerCode, externalEventId)` and provider-scoped external identifiers deduplicate replay. Payloads retain a hash rather than raw content. A timeout or unknown transfer result keeps funds RESERVED and opens reconciliation; only a proven definitive failure may compensate RESERVED back to AVAILABLE.

## Security

Threats include ledger tampering, duplicate posting, double withdrawal/reservation, negative-balance bypass, webhook replay/reorder/forgery, provider/local divergence, malicious metadata, secret leakage, external-ID collision, refund races, chargeback after withdrawal, and ambiguous transfer results. Mitigations are append-only/constraint triggers, canonical idempotency hashes, ordered advisory locks, typed and size-limited metadata at future boundaries, opaque secret references, unique external IDs, reconciliation, compensating postings, and integration tests against PostgreSQL.

Admin policy publication will require ADMIN, step-up/2FA, immutable audit actor/timestamp, and idempotency. An admin never edits a ledger entry, seller balance, or an immutable withdrawal request.

## PostgreSQL financial integration coverage

`backend/test/financial-domain.integration-spec.ts` is discovered by the existing `test:integration` configuration and exercises the financial migration against real PostgreSQL: deferred double-entry validation, currency and positive-money constraints, append-only triggers, derived/protected buckets, concurrent provisioning/posting/reservation, atomic rollback, external deduplication, relational ownership, compensation, and policy lifecycle/rule immutability. This suite requires the CI PostgreSQL service; unit tests are not treated as a substitute.

Published policy lifecycle updates are limited to the explicit DRAFT → SCHEDULED/ACTIVE/RETIRED, SCHEDULED → ACTIVE/RETIRED, and ACTIVE → RETIRED edges. Once a policy leaves DRAFT, its public version, effective interval, original author, creation timestamp, and all rules are immutable. Rule INSERT, UPDATE, and DELETE are accepted only while the parent remains DRAFT.

Serializable financial posting retries the complete atomic transaction at most three times only for Prisma `P2034`; domain, constraint, and permanent errors are never retried. Refund persistence now correlates the authoritative Payment and Order, records a typed reason/requester (nullable for system initiation), and exposes explicit lifecycle timestamps.

## PR #48 sale recognition

`SaleFinancialRecognitionService` now recognizes paid and activated orders in the ledger using the immutable checkout pricing snapshot. It posts `SALE_RECOGNIZED` through `FinancialLedgerService.postWithOutcome()` only, using the outcome to distinguish creation from idempotent replay: debit `PROVIDER_CLEARING`, credit `SELLER_PENDING` when seller proceeds are positive, and credit `PLATFORM_COMMISSION` when commission is positive. `FinancialLedgerService.post()` remains its compatibility wrapper for other consumers. No settlement, hold, PSP call, refund, chargeback, withdrawal, or seller release is introduced. See `SALE_FINANCIAL_RECOGNITION.md`.
