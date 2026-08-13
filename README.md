# LIT Buy

LIT Buy is a digital marketplace with distinct Buyer, Seller, and Admin surfaces. This repository contains a React frontend, a NestJS API, persistence and local infrastructure for the feature-frozen Alpha.

## Current status

> **Feature-frozen Alpha — NOT PRODUCTION READY.** The critical functional path is implemented and `PENDENTE DE IMPLEMENTAÇÃO ALPHA = 0`. Real money is not enabled. Security, operational, compliance, and production reviews remain required.

[`ALPHA_SCOPE_AND_COMPLETION_CHECKLIST.md`](./ALPHA_SCOPE_AND_COMPLETION_CHECKLIST.md) is the highest authority for functional status, Alpha boundaries, and production blockers. A completed Alpha item means implemented within its documented limits; it does not mean approved for production.

## What is implemented

The current critical path uses real application boundaries and persistent backend state for:

- authentication and server-side Buyer/Seller/Admin RBAC;
- Seller onboarding, Admin approval/rejection, listing moderation, product lifecycle, private S3-compatible images, and the public catalog;
- Buyer cart, seller-specific checkout, orders, and the non-production Alpha payment boundary (`FAKE_ALPHA`);
- fulfillment, Seller delivery registration, and Buyer receipt confirmation;
- Seller sales and owner-only finance read models;
- minimum Admin operations for onboarding, listings, catalog, and taxonomy;
- provider-neutral double-entry ledger foundations through `SELLER_PENDING → SELLER_HELD → SELLER_AVAILABLE`;
- Docker-based local rehearsal and deterministic demo data; and
- CI validation, backend integration infrastructure, structural audits, and critical no-mock guards.

These statements describe the Alpha scope only. The detailed evidence and limits are in the [Alpha completion checklist](./ALPHA_SCOPE_AND_COMPLETION_CHECKLIST.md).

## What is NOT production-ready

The repository does **not** provide or approve:

- real-money collection, payout, cash-out, or withdrawal;
- real KYC or production antifraud;
- a homologated production PSP;
- complete refunds, chargebacks, disputes, or financial reconciliation;
- final observability, alerting, backup/restore, or disaster recovery;
- final hosted infrastructure, scaling, or performance validation;
- pentest, production security signoff, or completion of the broader hardening work;
- final LGPD, legal, financial, and compliance approval; or
- a production launch.

## Legacy / demo surfaces

Legacy and mock-backed functionality remains deliberately preserved outside the critical Alpha path. Search, public seller store, favorites, reviews/questions, chat/messages, affiliates/growth, wallet/LIT Points, verification/KYC UI, Seller team/levels, and non-critical dashboards or Admin pages must not be inferred to be production-complete merely because a route or component exists.

Some legacy services are still consumed by those pages; some files need deeper static/runtime review. See [`LEGACY_AND_DEAD_CODE_INVENTORY.md`](./LEGACY_AND_DEAD_CODE_INVENTORY.md). Do **not** describe the current critical cart, checkout, order, Alpha payment, fulfillment, Seller finance, or minimum Admin path as mock.

## Architecture / stack

### Frontend

- React 19 and TypeScript;
- Vite 8 with TanStack Start/Router and TanStack Query;
- route files in `src/routes`, UI in `src/components`, API boundaries in `src/services` and `src/lib/api`;
- Vitest and Testing Library.

### Backend and infrastructure

- NestJS 11 and TypeScript;
- PostgreSQL with Prisma, Redis, and private S3-compatible object storage (MinIO locally);
- REST API under `/api/v1`;
- Docker Compose local staging rehearsal and GitHub Actions CI.

The frontend and backend have separate dependency manifests and validation commands.

## Repository map

```text
/
├── src/                         # frontend routes, components, providers, services and legacy data
├── backend/                     # NestJS API, Prisma schema/migrations, tests and CLI jobs
├── __tests__/                   # frontend/cross-boundary tests and structural guards
├── scripts/                     # local rehearsal, smoke and architecture audit scripts
├── .github/workflows/ci.yml     # CI validation and integration jobs
├── docker-compose.staging.yml   # loopback-only local staging rehearsal
└── *.md                         # current, domain, historical and planning documentation
```

## Quick start

Use [`ALPHA_LOCAL_STABILIZATION_RUNBOOK.md`](./ALPHA_LOCAL_STABILIZATION_RUNBOOK.md) as the operational authority. The essential commands from the repository root are:

```bash
bun install --frozen-lockfile
cd backend && bun install --frozen-lockfile && cd ..
bun run demo:prepare
bun run demo:check
```

Docker Compose v2 and the documented loopback ports are required. Do not substitute real personal, financial, or production data.

## Demo accounts

These public, deterministic credentials are **local-only, fictitious, and prohibited in hosted staging or production**:

| Role   | E-mail                        | Password          |
| ------ | ----------------------------- | ----------------- |
| Buyer  | `comprador@demo.litbuy.local` | `LitBuyDemo2026!` |
| Seller | `vendedor@demo.litbuy.local`  | `LitBuyDemo2026!` |
| Admin  | `admin@demo.litbuy.local`     | `LitBuyDemo2026!` |

## Validation

The runbook defines prerequisites and environment-dependent checks. Primary commands are:

```bash
# Frontend
bun run test
bun run typecheck
bun run build
bun run audit:public-foundation
bun run audit:commerce-architecture
bun run demo:prepare
bun run demo:check

# Backend
cd backend
bun run lint
bun run format:check
bun run typecheck
bun run test
bun run test:e2e
bun run prisma:validate
bun run prisma:generate
bun run build
# Requires the documented infrastructure:
bun run test:integration
bun run prisma:migrate:status
```

CI runs frontend validation, backend validation, service-backed integration, local staging-rehearsal smoke coverage, and critical-flow guards. Passing automated checks is evidence, not browser acceptance or production approval.

## Documentation

Start with [`DOCUMENTATION_INDEX.md`](./DOCUMENTATION_INDEX.md), which separates current authority from domain references, historical snapshots, future plans, and specialized material.

- Functional scope authority: [`ALPHA_SCOPE_AND_COMPLETION_CHECKLIST.md`](./ALPHA_SCOPE_AND_COMPLETION_CHECKLIST.md)
- Local operation: [`ALPHA_LOCAL_STABILIZATION_RUNBOOK.md`](./ALPHA_LOCAL_STABILIZATION_RUNBOOK.md)
- Pre-handoff sequence: [`PRE_HANDOFF_READINESS_CHECKLIST.md`](./PRE_HANDOFF_READINESS_CHECKLIST.md)

## Security status

### IMPLEMENTED FOUNDATIONS

Authentication controls, server-side RBAC, ownership checks, CSRF handling on critical mutations, persistent commerce invariants, provider-neutral payment/event boundaries, double-entry ledger foundations, private image storage, and critical no-mock structural guards exist within the Alpha scope.

### REQUIRES HUMAN REVIEW BEFORE PRODUCTION

Those foundations have **not** received final human production security approval. Threat-model verification, secrets and environment governance, complete hardening, pentest, provider/webhook operational review, privacy/data-retention review, infrastructure controls, incident response, and legal/compliance signoff remain required. Never use this README or passing CI as a security certification.

## What not to assume

- Alpha payment does not equal real-money readiness.
- Passing CI does not equal security approval.
- Legacy documents do not override current authority.
- Demo credentials are not production credentials.
- Staging-like local/CI infrastructure is not hosted staging.
- The presence of a page, component, service, or schema does not prove a production-complete feature.

## Handoff strategy

`repository clarity → limited critical-flow sanity check → Claude Code full-repository read-only audit → triage → approved low-risk fixes → production handoff package → human senior review → productionization`

Repository clarity is still in progress until this documentation change is published, remotely reviewed, and passes CI. See the [operational readiness checklist](./PRE_HANDOFF_READINESS_CHECKLIST.md).
