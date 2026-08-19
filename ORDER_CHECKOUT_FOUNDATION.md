# Order checkout foundation (PR #37)

Status: implementado e validado pelo CI #169 na PR #37, incorporada em `676dcaea5d3c8856b9df56dcb1ea91517edb13fd`. This foundation creates no payment and integrates no gateway.

## Contract and scope

Authenticated users with the exact `BUYER` role can create a server-authoritative pending order through `POST /api/v1/checkout-sessions`, read only their own snapshots through `GET /api/v1/orders` and `GET /api/v1/orders/:orderCode`, and cancel an unpaid order through `POST /api/v1/orders/:orderCode/cancel`. Mutations require the persisted session CSRF token and a validated `Idempotency-Key`.

Checkout reloads the active single-seller cart, verifies its optimistic version and deterministic SHA-256 preview fingerprint, reuses product publication and cart purchasability rules, recalculates BRL minor units with `bigint`, rejects quote services and self-purchase, and writes immutable `OrderItem` snapshots. Responses serialize monetary values as decimal strings and omit buyer IDs, private product fields, reservations, audit data, and storage keys.

## Persistence and concurrency

`Order` starts `PENDING_PAYMENT / NOT_CREATED / NOT_AVAILABLE / NONE`, expires after 15 minutes by default, and has a random `LIT-` public code and unique source cart. `NORMAL` reserves product stock, `DYNAMIC` reserves variant stock, `FIXED` creates no reservation, and `QUOTE` creates no order. Stock columns are never decremented. Transaction-scoped advisory locks are acquired in stable inventory-key order; live `ACTIVE` reservations are subtracted before inserts. The infrastructure-backed validation was completed by CI #169.

Idempotency stores only SHA-256 key and canonical request hashes, is scoped by actor and operation, and persists a safe replay response transactionally. Domain events are append-only and each owns one transactional pending outbox row. No worker or external publication exists. Audit failures roll back the commerce transaction.

Cancellation is limited to unpaid pending orders, increments the order version once, releases active reservations, and never revives the cart. `bun run orders:expire` performs the equivalent idempotent expiration in bounded batches; production must invoke it from a controlled scheduler.

## Security, errors, and next stage

Ownership is included directly in every order query, so seller/admin roles receive no bypass. Expected conflicts use stable domain codes including cart/version/fingerprint, stock, order, and idempotency errors. Database checks enforce BRL, integer totals, versions, quantities, uniqueness, and product-variant integrity.

There is deliberately no payment table, gateway, webhook, ledger, wallet, refund, delivery, or frontend checkout. PR #38 is the subsequent read-only frontend order integration.

## Validation status

The lint/type corrections, focused unit tests and infrastructure-backed validation were accepted in CI #169. This does not extend those results to the separate PR #38 CI run.

The real-infrastructure suites `checkout-orders-http.integration-spec.ts` and `order-checkout.integration-spec.ts` now exercise the real `AppModule`, authentication/session/CSRF guards, checkout snapshots, NORMAL/DYNAMIC/FIXED/QUOTE behavior, concurrent inventory reservations, same-cart and idempotency concurrency, buyer-scoped reads, cancellation, expiration, rollback triggers, and PostgreSQL constraints. `local-demo-data.integration-spec.ts` additionally creates and removes the complete demo order graph. CI #169 validated these PR #37 suites.

# Estado da fundação

A PR #37 foi validada pelo CI #169 e incorporada no commit `676dcaea5d3c8856b9df56dcb1ea91517edb13fd`. A integração frontend subsequente é somente de leitura e não altera a fundação de checkout do backend.

## COMMERCE-1SKU extension

PR #37 historically allowed checkout to materialize multiple cart lines. The current checkout rejects any cart whose cardinality is not exactly one before Order, reservation, event, outbox, idempotency-success, cart transition, or successful audit effects. A valid checkout creates exactly one `OrderItem` and at most one applicable reservation. A unique `orderId` index prevents a second persisted `OrderItem`; the migration fails closed on incompatible legacy Orders and never rewrites their snapshots.
# Seller release policy snapshot — CURRENT

Após as validações comerciais e a resolução da comissão, e antes da criação do Order, o checkout
resolve `SUBCATEGORY > CATEGORY > DEFAULT` usando exclusivamente a classificação do Product
validado pelo backend. O snapshot completo nasce atomicamente com Order/OrderItem/reservation e
falha fechado sem policy; replay idempotente concluído continua retornando a resposta persistida
antes de qualquer nova resolução. Pricing/commission e seller release policy são snapshots
financeiros distintos.
