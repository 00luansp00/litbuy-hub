# LIT Buy — limited Alpha critical-flow sanity report

## Baseline

- Authoritative main SHA: `ed37f37f1b2a72ebabf5aa84e0a57bb5c6912ccd`.
- Workspace branch at the start of this check: `work`.
- Classification of existing coverage: **C — partial coverage**. There is no single test that starts at Seller onboarding and ends at Seller finance. The strongest already-existing stateful scenario is `backend/test/seller-finance-read.integration-spec.ts` (`exposes pending, held, and available checkpoints from the real commerce chain`), which crosses real PostgreSQL/NestJS services from cart through checkout, persisted Order, activation, financial recognition, fulfillment, Buyer confirmation, hold, release, and owner-only finance reads. Earlier Seller/catalog steps and the `FAKE_ALPHA` boundary are covered by separate tests.
- No new test was created: duplicating the strong commerce-to-finance stateful scenario would add little evidence, while joining every independently covered domain would require a new broad harness rather than a limited sanity check.

## Scope

This check inventoried and ran the environment-independent backend, frontend, critical no-mock, authorization, and architecture suites. It inspected the existing PostgreSQL integration chain and the separate onboarding, listing/moderation, materialization, lifecycle, catalog, cart/checkout, payment, activation, fulfillment, ledger, hold/release, and finance integration coverage.

It did **not** test production, real money, a real PSP, hosted staging, homologation, performance, pentesting, general visual QA, or non-critical search/store/favorites/reviews/chat/affiliates/wallet/KYC/team/promotions/Admin surfaces. No real or personal data was used. No production handoff, Workana work, or Claude audit was started.

## Environment

| Item       | Observed state                                             |
| ---------- | ---------------------------------------------------------- |
| Runtime    | Bun `1.2.14`; local Codex workspace                        |
| Docker     | Unavailable (`docker: command not found`)                  |
| PostgreSQL | Not available at `localhost:5432`                          |
| Redis      | Not started; Docker unavailable                            |
| MinIO      | Not started; Docker unavailable                            |
| CI         | Remote validation completed successfully as recorded below |
| Data       | Test fixtures only; no real data                           |

Consequently, this run does not claim a green local rehearsal. `demo:prepare`, `demo:check`, and the service-backed integration suite could not produce runtime stateful evidence in this environment.

## Remote CI validation

- PR: `#71`.
- Audited remote HEAD: `3fa5a34420d05b3eff9fcbe56857016776fcc51f`.
- CI: `#290`, run `31701477029` — **SUCCESS**.
- The remote runner supplied PostgreSQL, Redis, and MinIO with a prepared private bucket, applied Prisma migrations, and successfully ran `bun run test:integration`. It also built and started the staging-like Compose environment and passed health, demo-data, staging-smoke, and infrastructure-smoke checks.
- This was CI with staging-like infrastructure on the runner. It was **not hosted staging**.

The workflow executes `bun run test:integration`; `backend/package.json` routes that command through `backend/test/jest-integration.json`, whose `testRegex` includes `*.integration-spec.ts`. Therefore `backend/test/seller-finance-read.integration-spec.ts` was part of the green remote integration suite. Its PostgreSQL-backed scenario statefully validated cart → checkout → persisted Order → test Payment → paid-order activation → financial recognition → `SELLER_PENDING` → fulfillment/delivery → Buyer receipt confirmation → `SELLER_HELD` → release eligibility → `SELLER_AVAILABLE` → Seller finance summary/activity.

## Evidence matrix

| Step                                        | Boundary                                                      | Evidence                                                                                                                                              | Result                                                                            |
| ------------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Seller onboarding                           | `SellerOnboardingService` + PostgreSQL                        | `backend/test/app.integration-spec.ts` onboarding block; `backend/src/seller-onboarding/seller-onboarding.service.spec.ts`; frontend onboarding tests | PASS — separate integration/unit/frontend evidence; remote integration green      |
| Admin approval / persisted role and profile | Admin review through onboarding service                       | `backend/test/app.integration-spec.ts` approval/rollback/concurrency cases; `__tests__/admin-critical-path-no-mock.test.ts`                           | PASS — separate integration and structural evidence                               |
| Listing draft                               | Seller listing API/service + PostgreSQL                       | `backend/test/app.integration-spec.ts`; `backend/test/listing-drafts.e2e-spec.ts`; listing frontend tests                                             | PASS — remote integration plus E2E/frontend evidence                              |
| Moderation                                  | Admin listing moderation + materialization boundary           | `backend/test/app.integration-spec.ts`; `backend/test/listing-drafts.e2e-spec.ts`                                                                     | PASS — remote integration plus E2E evidence                                       |
| Product materialization                     | `ProductMaterializationService`                               | materialization cases in `backend/test/app.integration-spec.ts`; service spec                                                                         | PASS — remote integration plus unit evidence                                      |
| Product lifecycle                           | `ProductLifecycleService` + HTTP                              | `backend/test/product-lifecycle*.integration-spec.ts`; service/frontend tests                                                                         | PASS — remote integration plus unit/frontend evidence                             |
| Public catalog                              | public catalog HTTP/service                                   | `backend/test/public-product-catalog*.integration-spec.ts`; frontend public-catalog tests; public foundation audit                                    | PASS — remote PostgreSQL/MinIO integration plus frontend/audit evidence           |
| Cart                                        | `CartsService` / real cart API                                | `backend/test/carts*.integration-spec.ts`; stateful finance scenario; frontend critical-flow guard                                                    | PASS — remote stateful integration plus frontend guard                            |
| Checkout                                    | `CheckoutService`, server price/stock/fingerprint/idempotency | `backend/test/order-checkout.integration-spec.ts`; stateful finance scenario; checkout frontend tests                                                 | PASS — remote stateful integration plus frontend/unit evidence                    |
| Order                                       | persisted `Order` and Buyer reads                             | `backend/test/checkout-orders-http.integration-spec.ts`; stateful finance scenario; Buyer order E2E/frontend tests                                    | PASS — remote stateful integration plus E2E/frontend evidence                     |
| Payment Alpha                               | `BuyerPaymentService` + `FakePaymentProvider('FAKE_ALPHA')`   | buyer payment unit/E2E/frontend tests; payment orchestration integration tests                                                                        | PASS — separately validated boundary; not part of the `LOCAL_TEST` stateful chain |
| Payment event / activation                  | provider event processor + `PaidOrderActivationService`       | provider-event and activation integration specs; activation unit spec                                                                                 | PASS — remote integration plus unit evidence                                      |
| Seller sale read                            | owner-only Seller order HTTP                                  | `backend/test/seller-orders-http.integration-spec.ts`; Seller sales frontend/no-mock tests                                                            | PASS — remote integration plus frontend/no-mock evidence                          |
| Seller delivery                             | `OrderFulfillmentService.recordDelivered`                     | `backend/test/order-fulfillment.integration-spec.ts`; stateful finance scenario; Seller sales tests                                                   | PASS — remote stateful integration plus frontend evidence                         |
| Buyer fulfillment / receipt                 | Buyer order read + `confirmReceipt`                           | fulfillment integration spec and stateful finance scenario; Buyer order frontend/service tests                                                        | PASS — remote stateful integration plus frontend evidence                         |
| Ledger recognition                          | `SaleFinancialRecognitionService`                             | sale-recognition integration spec; stateful finance scenario                                                                                          | PASS — remote stateful PostgreSQL integration                                     |
| `SELLER_PENDING → SELLER_HELD`              | `SellerPendingHoldService`                                    | pending-hold integration spec; stateful finance scenario                                                                                              | PASS — remote stateful PostgreSQL integration                                     |
| `SELLER_HELD → SELLER_AVAILABLE`            | eligibility + held-funds release services                     | release-policy/eligibility integration specs; stateful finance scenario                                                                               | PASS — remote stateful PostgreSQL integration                                     |
| Seller finance                              | owner-only summary/activity HTTP                              | `backend/test/seller-finance-read.integration-spec.ts` stateful scenario; Seller finance unit/frontend tests                                          | PASS — remote stateful integration plus unit/frontend evidence                    |

The stateful finance scenario deliberately creates a paid test Payment with provider code `LOCAL_TEST`; it does not itself traverse `FAKE_ALPHA`. The real Alpha payment boundary is therefore established by separate payment tests, not falsely attributed to that chain.

## Authorization/invariants

- Frontend critical-path/no-mock guards passed for Seller, Buyer, and minimum Admin routes.
- Existing E2E and unit suites passed and cover RBAC/ownership, Buyer receipt payload shape, Seller finance ownership, Admin-only routes, server-side payment configuration, and fail-closed `FAKE_ALPHA` production configuration.
- Existing PostgreSQL specs explicitly cover foreign ownership/IDOR rejection, server-owned pricing and stock, checkout fingerprint/idempotency, immutable minor-unit snapshots, payment-event authority, fulfillment actor checks, ledger postings, and owner-only finance reads. They could not be re-executed in Codex, but the containing integration suite passed in remote CI #290.

## Frontend wiring evidence

`bun run test` passed 68 files / 654 tests, including `__tests__/alpha-critical-flow-no-mock.test.ts`, `__tests__/admin-critical-path-no-mock.test.ts`, `__tests__/buyer-payment-mock-guard.test.ts`, and `__tests__/seller-sales-no-mock.test.ts`. Together they bind catalog, add-to-cart, cart, checkout, Buyer order/payment/confirmation, Seller sales/delivery/finance, onboarding, listing moderation, product lifecycle, and minimum Admin routes to the real API services and forbid the identified legacy authorities. Typecheck and the production build also passed.

This is wiring evidence, composed with—not substituted for—the PostgreSQL integration execution confirmed by remote CI.

## Browser status

**BROWSER E2E COMPLETO NÃO EXECUTADO.** No ready browser automation framework was identified or installed, as required by the limited scope.

## Mock authority check

The critical no-mock guards passed. No legacy/mock service was found with functional authority over the inventoried Alpha critical route chain. `FAKE_ALPHA` is the explicit non-production provider boundary, not frontend authority and not real money. Legacy/mock files outside the critical path remain intentionally untouched.

## Bugs / blockers

### BLOCKER

- None objectively reproduced in application behavior. The unavailable infrastructure is an environment limitation, not classified as a product bug.

### NON-BLOCKING

- The build reports existing route-file warnings for `src/routes/checkout.test.tsx` and `src/routes/checkout.mock-guard.test.ts`, plus bundle-size/plugin warnings. The build succeeds; these are outside this limited sanity scope and were not changed.
- Existing coverage is partial rather than one onboarding-to-finance scenario. The strongest stateful test begins at cart, while earlier Seller/catalog and Alpha-payment boundary evidence is separate.

### ENVIRONMENT LIMITATION

- Docker/Compose is absent, so PostgreSQL, Redis, and MinIO could not be provisioned.
- `bun run demo:prepare` failed at the Docker prerequisite; `bun run demo:check` failed because the local application health endpoint was not running.
- `bun run test:integration` failed all 26 suites / 470 tests because Prisma could not reach PostgreSQL at `localhost:5432`; this is not recorded as an application regression.
- These limitations describe only the Codex workspace run; CI #290 subsequently supplied and validated the service-backed infrastructure.

## Validation results

| Command                                  | Result                                                                           |
| ---------------------------------------- | -------------------------------------------------------------------------------- |
| `bun run test`                           | PASS — 68 files, 654 tests                                                       |
| `bun run typecheck`                      | PASS                                                                             |
| `bun run build`                          | PASS with the non-blocking warnings recorded above                               |
| `bun run audit:public-foundation`        | PASS — `ok: true`, no failures                                                   |
| `bun run audit:commerce-architecture`    | PASS — `ok: true`, no failures                                                   |
| `bun run demo:prepare`                   | ENVIRONMENT LIMITATION — Docker missing                                          |
| `bun run demo:check`                     | ENVIRONMENT LIMITATION — services not running                                    |
| `cd backend && bun run lint`             | PASS                                                                             |
| `cd backend && bun run format:check`     | PASS                                                                             |
| `cd backend && bun run typecheck`        | PASS                                                                             |
| `cd backend && bun run test`             | PASS — 42 suites, 581 tests                                                      |
| `cd backend && bun run test:e2e`         | PASS — 6 suites, 58 tests                                                        |
| `cd backend && bun run prisma:validate`  | PASS                                                                             |
| `cd backend && bun run prisma:generate`  | PASS                                                                             |
| `cd backend && bun run build`            | PASS                                                                             |
| `cd backend && bun run test:integration` | ENVIRONMENT LIMITATION — 26 suites / 470 tests unable to connect to PostgreSQL   |
| Remote CI `#290` / run `31701477029`     | PASS — service-backed integration and staging-like checks on audited remote HEAD |

## Feature-freeze compliance

Zero feature, scope expansion, general refactor, runtime/provider change, real-money work, dependency, schema change, or migration was introduced. This change contains documentation/evidence only.

## Conclusion

**PASS — LIMITED PRE-HANDOFF CRITICAL-FLOW SANITY**

This PASS means the composed stateful commerce-to-finance, separate Alpha-payment-boundary, and frontend critical-wiring evidence is sufficient for this limited pre-handoff gate. It does **not** mean browser E2E completion, full manual acceptance, hosted staging, production readiness, real-money readiness, security approval, pentest completion, or human production review.
