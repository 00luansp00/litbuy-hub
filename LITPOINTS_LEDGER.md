# LIT Points ledger foundation (S)

## Authority and domain boundary

LIT Points (LP) are an internal reward unit. LP are not money, are not a BRL
balance, cannot be withdrawn, and cannot be transferred. The authoritative
record is the persistent append-only ledger; there is deliberately no
`User.points`, `User.litPoints`, mutable wallet counter, monetary account, or
conversion to minor currency units.

The frontend service that predates S remains demonstrative legacy. Its invented
balances, history, earn/redeem simulations, expiry, campaigns, review or
reputation bonuses, and multipliers are not migrated, seeded, or treated as
runtime authority. This backend foundation exposes only authenticated balance
and history reads. A future frontend slice can replace the mock presentation
without inheriting its product claims.

## Persistent model and invariants

`LitPointsLedgerTransaction` represents one logical operation and owns one or
more `LitPointsLedgerEntry` records. Each transaction has a real `User` foreign
key plus first-class operation, source, source reference, server timestamp,
request hash, and globally unique operation key. Critical provenance is not
hidden in arbitrary metadata.

Each entry belongs to the same User as its transaction through a composite
foreign key. It records a non-zero signed `BIGINT` delta in exactly one of the
structural buckets `PENDING` or `AVAILABLE`. LP are integer units; HTTP reads
serialize their potentially long-lived `BIGINT` totals and deltas explicitly as
base-10 strings.

There is no persisted balance. `pending` and `available` are always derived by
summing their ledger entries, so a User with no entries has the zero state
`pending = 0`, `available = 0`, and empty history. Paginating history does not
affect either sum.

PostgreSQL constraints enforce non-zero entries, required provenance, ownership,
and the unique operation key. Database triggers reject `UPDATE` and `DELETE` on
transactions and entries. Corrections in later capabilities must append a new
compensating operation instead of rewriting evidence.

The internal domain writer inserts a transaction and all entries in one database
transaction. The unique operation key and transaction-scoped advisory lock make
identical retry, job, worker, or webhook replay one logical effect, including
concurrent replay. Reuse with different content is rejected. This writer is not
an HTTP mint endpoint.

## Authenticated read contract

- `GET /lit-points/me` derives the caller's `pending` and `available` totals.
- `GET /lit-points/me/history` returns cursor-paginated entries for that same
  authenticated User.

There is no user-id selector and no public or Admin mutation. Public history
omits user IDs, operation keys, request hashes, arbitrary metadata, PII,
third-party internal IDs, security data, and financial BRL data.

## Explicitly outside S

**PENDING → AVAILABLE REMAINS OWNER DECISION REQUIRED.** The buckets exist only
as structural recording targets. S defines no payment, delivery, confirmation,
completion, release, dispute, or time-based availability trigger and creates no
`availableAt`, scheduler, or transition job.

S implements no Buyer earn (T1), Seller/MAX earn (T2), multiplier, review,
reputation or campaign reward; no expiry/lots/FEFO (U); no redemption,
reservation, checkout, exchange rate, mixed tender or funding (V/V2); no refund
or reversal policy (W); and no Admin configuration or mutation. Tests may append
to either authorized bucket through the internal writer solely to prove the
foundation. Future T/U/V/W consumers must use separate audited capabilities and
append operations without changing this history.
