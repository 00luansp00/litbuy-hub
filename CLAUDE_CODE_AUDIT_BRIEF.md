# LIT Buy — Claude Code audit brief

This brief is factual readiness context for a future full-repository audit. It is not an audit report, an operational audit prompt, a production approval, or authorization to change the repository.

## Audit baseline selection

- Repository: `00luansp00/litbuy-hub`
- Readiness source baseline: `8b8031f21e5c9037ce7742374e91dd7b2a1a4f16`
- Readiness branch/base: `main`
- Future audit target: **MUST BE AN EXPLICIT IMMUTABLE SHA PROVIDED IN THE OPERATIONAL AUDIT PROMPT AFTER PR #72 IS MERGED.**

The readiness source baseline is the `main` SHA from which PR #72 was prepared; it is not the future audit target. The target must contain this readiness package, including `CLAUDE_CODE_AUDIT_BRIEF.md`, `CLAUDE_CODE_READINESS_REPORT.md`, `DOCUMENTATION_INDEX.md`, and `PRE_HANDOFF_READINESS_CHECKLIST.md`. It will be selected after PR #72 is merged and will normally be the confirmed merge commit or resulting `main` SHA.

The operational audit prompt must provide that immutable target without making this document self-referential. Claude must record the exact SHA received, must not substitute “latest main”, and must not advance to any later SHA without express authorization.

## Current state

- This is a feature-frozen Alpha with `PENDENTE DE IMPLEMENTAÇÃO ALPHA = 0`.
- The critical Buyer/Seller/Admin path is implemented within the documented Alpha boundaries.
- The limited pre-handoff critical-flow sanity result is **PASS**.
- The repository is **NOT production-ready**, **NOT security-approved**, and **NOT real-money-ready**.

These statements do not claim hosted staging, complete browser E2E, pentesting, final human review, or production approval.

## Document read order and authority

Recommended order:

1. `CLAUDE_CODE_AUDIT_BRIEF.md`
2. `README.md`
3. `DOCUMENTATION_INDEX.md`
4. `ALPHA_SCOPE_AND_COMPLETION_CHECKLIST.md`
5. `PRE_HANDOFF_READINESS_CHECKLIST.md`
6. `CRITICAL_FLOW_SANITY_REPORT.md`
7. `ALPHA_LOCAL_STABILIZATION_RUNBOOK.md`
8. `LEGACY_AND_DEAD_CODE_INVENTORY.md`
9. `DEVELOPER_HANDOFF.md`
10. relevant current domain references identified by `DOCUMENTATION_INDEX.md`
11. code, tests, Prisma schema/migrations, and CI

`DOCUMENTATION_INDEX.md` defines document classification and precedence. `ALPHA_SCOPE_AND_COMPLETION_CHECKLIST.md` remains the highest authority for Alpha functional scope and status. Documents classified as HISTORICAL / SUPERSEDED cannot downgrade current implementation status; planning documents are not implementation evidence. Code and executable evidence must still be checked rather than accepting documentation claims uncritically.

## Priority critical flow

The audit must prioritize this composed path:

Seller onboarding → Admin approval → ListingDraft → moderation → Product materialization/lifecycle → public catalog → Buyer cart → checkout → Order → Alpha payment boundary → order activation → Seller sale/delivery → Buyer receipt confirmation → financial recognition → `SELLER_PENDING` → `SELLER_HELD` → `SELLER_AVAILABLE` → Seller finance.

There is no claim of one monolithic end-to-end test. The stateful commerce-to-finance test uses `LOCAL_TEST` for Payment. The deliberately non-production `FAKE_ALPHA` boundary is validated separately. See `CRITICAL_FLOW_SANITY_REPORT.md` for the evidence composition and limitations.

## Legacy / mock interpretation

The auditor must assume that:

- mock presence in the repository does **not** automatically mean the critical path is mocked;
- no legacy surface is authoritative implementation without verifying its actual consumers;
- `LEGACY_AND_DEAD_CODE_INVENTORY.md` is a discovery starting point, not final proof;
- `DEAD CANDIDATE` does not mean safe to remove; and
- `FAKE_ALPHA` is a deliberately non-production Alpha payment boundary, not a fake frontend with authority over financial state.

A later audit should gather enough evidence to classify each legacy/mock surface as `REAL`, `IMPLEMENTAR`, `DESABILITAR`, `FUTURO`, or `DEAD CANDIDATE`. This brief makes no final disposition and authorizes no deletion.

## Future audit rules: read-only first

Claude Code must initially operate in **READ-ONLY** mode. It must not:

- edit code or existing documentation;
- install dependencies;
- alter schema or create migrations;
- refactor or correct findings;
- remove files;
- commit, push, or open a pull request; or
- decide architectural changes without human approval.

The audit produces findings first. Corrections may begin only after human triage and separate authorization. This brief defines rules and context; it does not replace the future operational prompts.

## Evidence standard

Every finding must include:

- severity and category;
- file(s), plus symbol, route, service, or table when applicable;
- concrete evidence;
- expected behavior;
- observed behavior or specifically evidenced risk;
- impact;
- exploitation or failure scenario when applicable;
- confidence;
- recommendation;
- whether it blocks production;
- whether AI can correct it with low risk; and
- whether it requires senior human decision or review.

Unsupported statements such as “parece inseguro”, “provavelmente está errado”, or “melhor refatorar” are not findings.

## Severity and category taxonomy

Severities are `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`, and `INFORMATIONAL`. `CRITICAL` and `HIGH` require especially strong, directly traceable evidence.

Each finding must separately use one of these categories:

- `CONFIRMED DEFECT`
- `PRODUCTION GAP`
- `ARCHITECTURAL RISK`
- `SECURITY FINDING`
- `DOCUMENTATION GAP`
- `LEGACY / DEAD-CODE FINDING`

## Future Claude audit passes

The passes below are future work and have **not** been executed by this readiness task.

### Pass 1 — Repository comprehension

Factually map frontend, backend, database, auth, RBAC, Seller, Admin, Buyer, catalog, orders, payments, ledger, fulfillment, storage, infrastructure, tests, and CI. Produce a map before making recommendations.

### Pass 2 — Functional / architectural audit

Investigate broken flows, routes without backend support, backend without consumers, frontend/API/database inconsistencies, impossible states, race conditions, idempotency gaps, incorrect authority, and inconsistent lifecycles.

### Pass 3 — Security audit

- **Auth:** access and refresh tokens, cookies, CSRF, CORS, password reset, email verification, brute force, enumeration, session invalidation, and device/session flows.
- **Authorization:** RBAC, IDOR, Buyer/Seller/Admin isolation, mass assignment, and privilege escalation.
- **Input / web:** injection, XSS, SSRF, uploads, signed URLs, unsafe redirects, validation, secret exposure, and sensitive logging.
- **Payment / commerce / ledger:** client price manipulation, stock and checkout races, replay, idempotency, double activation, double fulfillment, double financial recognition, double release, ledger imbalance, owner isolation, and webhook/provider trust boundaries.

### Pass 4 — Production readiness

Cover hosting assumptions, managed PostgreSQL, Redis, object storage, backups, restore, disaster recovery, HTTPS/domain, secret management, migrations/deploy, rollback, monitoring, logging, alerting, rate limits, cron/workers, email, PSP, webhooks, reconciliation, LGPD, KYC when applicable, antifraud, and operational runbooks.

### Pass 5 — Mock / legacy / dead code

Investigate every known surface and establish with evidence whether it is used, legacy but used, demo, unreachable, duplicated, frontend-only, backed but disconnected, a mock with authority, or a removal candidate. Do not delete anything.

## Expected consolidated output

Consolidate evidenced findings under:

A. `IMPLEMENTED / ACCEPTABLE — DON'T TOUCH`
B. `IMPLEMENTED BUT HUMAN REVIEW REQUIRED`
C. `MUST FIX BEFORE PRODUCTION`
D. `MUST IMPLEMENT FOR PRODUCTION`
E. `LEGACY / MOCK DISPOSITION REQUIRED`

Every item must state evidence, priority, ownership, and risk.

## Environment and secret readiness

The following tracked templates exist:

- `.env.example`
- `frontend/.env.staging.example`
- `backend/.env.example`
- `backend/.env.staging.example`
- `backend/.env.staging.local.example`

They are configuration templates, including explicit local/demo placeholders where applicable, and are not authorization to reuse values in a hosted or production environment. The expected local/staging configuration names and topology are also visible in `docker-compose.staging.yml`, `.github/workflows/ci.yml`, and the stabilization runbook. No objective gap preventing an auditor from identifying the expected configuration names was found in this bounded inspection.

Real secrets must not be supplied to Claude Code, a freelancer, audit output, logs, commits, or prompts. The readiness inspection was limited to example files, documented variable references, staging Compose, and CI; it did not search unrelated locations or reproduce values. No apparent real secret was identified in that bounded inspection. This is not a repository-wide secret scan or a security certification.

## Reproducibility

Use `ALPHA_LOCAL_STABILIZATION_RUNBOOK.md` as the operational authority rather than duplicating it here. Its principal validation groups cover frontend tests/typecheck/build and structural audits, backend lint/format/typecheck/tests/Prisma/build, service-backed integration, and local demo rehearsal.

The first comprehension pass does not require starting the environment. Later passes may execute existing tests only when needed to validate a finding, without installing or changing dependencies.

## Security disclaimer

**Claude Code does not certify security. Passing tests does not certify security. Green CI does not certify security. A final real-money decision requires senior human review.**
