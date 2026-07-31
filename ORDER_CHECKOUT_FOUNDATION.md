# Order checkout foundation (PR #37)

Status: implementado, aguardando validação integral do CI. This foundation creates no payment and integrates no gateway; CI #163 remains red until the correction commit is validated.

## Contract and scope

Authenticated users with the exact `BUYER` role can create a server-authoritative pending order through `POST /api/v1/checkout-sessions`, read only their own snapshots through `GET /api/v1/orders` and `GET /api/v1/orders/:orderCode`, and cancel an unpaid order through `POST /api/v1/orders/:orderCode/cancel`. Mutations require the persisted session CSRF token and a validated `Idempotency-Key`.

Checkout reloads the active single-seller cart, verifies its optimistic version and deterministic SHA-256 preview fingerprint, reuses product publication and cart purchasability rules, recalculates BRL minor units with `bigint`, rejects quote services and self-purchase, and writes immutable `OrderItem` snapshots. Responses serialize monetary values as decimal strings and omit buyer IDs, private product fields, reservations, audit data, and storage keys.

## Persistence and concurrency

`Order` starts `PENDING_PAYMENT / NOT_CREATED / NOT_AVAILABLE / NONE`, expires after 15 minutes by default, and has a random `LIT-` public code and unique source cart. `NORMAL` reserves product stock, `DYNAMIC` reserves variant stock, `FIXED` creates no reservation, and `QUOTE` creates no order. Stock columns are never decremented. Transaction-scoped advisory locks are acquired in stable inventory-key order; live `ACTIVE` reservations are subtracted before inserts. The complete overselling and concurrency proof awaits the infrastructure-backed CI run.

Idempotency stores only SHA-256 key and canonical request hashes, is scoped by actor and operation, and persists a safe replay response transactionally. Domain events are append-only and each owns one transactional pending outbox row. No worker or external publication exists. Audit failures roll back the commerce transaction.

Cancellation is limited to unpaid pending orders, increments the order version once, releases active reservations, and never revives the cart. `bun run orders:expire` performs the equivalent idempotent expiration in bounded batches; production must invoke it from a controlled scheduler.

## Security, errors, and next stage

Ownership is included directly in every order query, so seller/admin roles receive no bypass. Expected conflicts use stable domain codes including cart/version/fingerprint, stock, order, and idempotency errors. Database checks enforce BRL, integer totals, versions, quantities, uniqueness, and product-variant integrity.

There is deliberately no payment table, gateway, webhook, ledger, wallet, refund, delivery, frontend checkout, or frontend orders integration. PR #38 remains the frontend order-reading stage after this backend foundation passes CI.

## Validation status

The lint/type corrections and focused unit tests are implemented locally. PostgreSQL/Redis/MinIO HTTP integration, rollback-trigger, constraint-execution, staging, smoke, and double-reset evidence must only be recorded here after the corresponding CI jobs pass; this document does not currently claim those proofs as completed.

The real-infrastructure suites `checkout-orders-http.integration-spec.ts` and `order-checkout.integration-spec.ts` now exercise the real `AppModule`, authentication/session/CSRF guards, checkout snapshots, NORMAL/DYNAMIC/FIXED/QUOTE behavior, concurrent inventory reservations, same-cart and idempotency concurrency, buyer-scoped reads, cancellation, expiration, rollback triggers, and PostgreSQL constraints. `local-demo-data.integration-spec.ts` additionally creates and removes the complete demo order graph. These tests are implemented and await the next full CI run before their results or totals are described as proven.
