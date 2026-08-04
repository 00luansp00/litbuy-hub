# Provider payment event application

This increment applies the provider-neutral flow
`ProviderWebhookEvent -> durable claim -> local correlation -> provider GET -> validation -> PaymentAttempt/Payment`.
The worker claims eligible rows with `FOR UPDATE SKIP LOCKED`, commits `PROCESSING` and an incremented
fencing generation, and only then performs the read-only PSP request. Final transactions lock and
revalidate that generation, so a stale worker cannot write financial state or reconciliation data.

A webhook is evidence, not the sole source of truth. Terminal events correlate exclusively through
`providerCode + externalPaymentId`; the selected provider adapter then confirms identity, current
status, BRL currency, and the amounts stored on PaymentAttempt, Payment, and Order. Provider reads
are outside PostgreSQL transactions, and this flow performs no provider mutation.

Confirmed success idempotently marks the attempt `SUCCEEDED`, the Payment `PAID`, and records the
provider event's `occurredAt` as `paidAt`. Missing timestamps, inconsistent statuses, currency or
amounts, a second successful attempt, and missing local/provider records fail closed or create a
`ReconciliationIssue`. Missing-local and eventually-consistent provider states receive bounded
backoff first; safe read failures remain recoverable, while ambiguity is routed to reconciliation.
Old failure events cannot regress a provider-confirmed success. A confirmed failed or expired
attempt does not make the aggregate Payment failed, because another attempt may still succeed.

Late payment records financial truth but never reactivates an expired/cancelled Order or its
reservation. It creates `LATE_PAYMENT` when the Order is terminal, payment occurred after expiry,
or a reservation was released/expired. Deliberately, this stage can leave `Payment = PAID` while
`Order = PENDING_PAYMENT`; the local worker documented in `PAID_ORDER_ACTIVATION.md` performs the
atomic activation and inventory consumption. Fulfillment, ledger postings, settlement, and holds
remain deferred to later PRs.
