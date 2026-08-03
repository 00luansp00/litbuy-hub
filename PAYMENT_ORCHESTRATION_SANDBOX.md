# Payment orchestration sandbox

## Implemented boundary

This increment adds an internal, provider-neutral `PaymentOrchestrationService` for:

`Order -> Payment -> PaymentAttempt -> PaymentProviderPort -> Efí sandbox`

There is no public payment endpoint in this increment. The sole supported method intent is
`BILLING`, representing the generic Efí Billing `/v1/charge` operation already implemented by the
adapter. It does **not** represent a usable Pix QR code, boleto, or card payment.

The service accepts buyer identity, Order ID, and a pre-hashed validated Idempotency-Key. Price,
seller, currency, expiry, and lifecycle states are loaded from the persisted Order. A real Payment
is created once per Order in `PENDING`; `NOT_CREATED` remains only the Order's pre-Payment marker.
Creation does not activate the Order and does not write to the financial ledger.

## Commit-before-provider and concurrency

A PostgreSQL transaction-scoped advisory lock serializes payment initiation by Order. The service
validates ownership and eligibility, resolves internal idempotency, creates or reuses the Payment,
and persists a sequential `PaymentAttempt` in blocking `PENDING` state. That transaction commits
before `PaymentProviderPort.createPayment()` is invoked, so no database transaction remains open
during Efí HTTP traffic.

`PENDING`, `PROCESSING`, and `REQUIRES_ACTION` attempts block a different key. Only a definitively
terminal attempt (`FAILED`, `EXPIRED`, or `CANCELLED`) permits a later attempt. Consequently, a
persisted attempt is an at-most-once external mutation token: replay never invokes
`createPayment()` for that attempt, even though Efí Billing provides no documented idempotency
guarantee for the POST.

## Internal idempotency

Only a SHA-256 hash scoped to actor and operation is stored; raw Idempotency-Keys are neither
stored nor passed to Efí. The canonical request hash covers actor, operation, Order, and the
`BILLING` intent. An identical key and request reuses the local attempt/result. Reusing the key for
a different semantic request fails with `IDEMPOTENCY_KEY_REUSED`. Advisory locking deliberately
handles concurrent requests rather than relying only on unique constraints.

## Ambiguity and reconciliation

The provider port exposes provider-neutral definitive, safe-retry, and ambiguous failure classes.
Efí-specific DTOs and `EfiProviderError` remain inside the adapter. Timeout, connection loss, and
mutation 429/5xx outcomes are normalized as ambiguous.

An ambiguous creation leaves the pre-committed attempt blocking, creates an open
`ReconciliationIssue`, and never marks the Payment paid, activates the Order, releases inventory,
or posts ledger entries. Unexpected final/sensitive provider states and amount mismatches also fail
closed into reconciliation.

If Efí creates a charge but persisting its external ID fails, best-effort reconciliation is
materialized. Even if that database write also fails, the earlier `PENDING` attempt remains the
durable at-most-once barrier: neither the same key nor a new key can produce a second POST.

## Still pending

This is sandbox orchestration only. Public endpoints, frontend checkout, usable Pix/boleto/card
instruments, webhooks and notification processing, payment confirmation, Order activation,
inventory consumption, ledger postings, settlement, fulfillment, refunds, chargebacks, wallets,
withdrawals, split, KYC, and Efí production enablement remain outside this increment.
