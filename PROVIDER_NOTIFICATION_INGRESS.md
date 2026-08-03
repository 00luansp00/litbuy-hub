# Provider notification ingress

## Implemented flow

Efí Billing sends `POST /api/v1/webhooks/efi/billing` as
`application/x-www-form-urlencoded` with exactly one `notification` field. The endpoint performs
strict, bounded validation, encrypts the token, inserts a new `ProviderNotificationInbox` delivery,
waits for the PostgreSQL commit, and returns `204 No Content`. It never calls Efí. The feature is
off by default through `EFI_BILLING_NOTIFICATION_INGRESS_ENABLED=false`; enabled startup fails
closed unless Efí and notification-key configuration are valid.

The provider-neutral worker claims eligible deliveries with PostgreSQL `FOR UPDATE SKIP LOCKED`,
marks the row `PROCESSING`, increments attempts, and commits. Only then does it decrypt the token
and call the notification port, whose Efí Billing adapter performs
`GET /v1/notification/:token`. No PostgreSQL transaction remains open during that HTTP request.
Normalized `ProviderWebhookEvent` rows and the inbox's `PROCESSED` state are committed atomically.

## Token protection and delivery identity

Tokens are encrypted at application level with AES-256-GCM. The database stores key identifier,
format version, random 96-bit IV, ciphertext, authentication tag, and a SHA-256 correlation hash;
plaintext is never persisted, logged, returned, or placed in ordinary audit metadata. The
32-byte base64 key and key identifier are secret-manager configuration without production defaults.

Callbacks represent deliveries, not unique lifecycles. Every valid HTTP callback creates its own
inbox row, including repeated tokens. Normalized events—not deliveries—are deduplicated by
`providerCode + externalEventId`. An identical replay is idempotent. Incompatible data under the
same identity is not overwritten and creates a `ReconciliationIssue`.

## Retry and ordering

Provider-neutral `SAFE_TO_RETRY` read failures retain the inbox and schedule deterministic bounded
backoff. Definitive failures become operationally terminal. Ambiguous/reconciliation-required
failures create a correlated issue and never invent an event. A stale processing lease can be
reclaimed after a worker crash. Provider `occurredAt` is preserved because arrival order is not
authority. The incremented claim attempt is also a fencing generation: every final transaction
locks the inbox and rejects local effects from a worker whose stale claim was superseded. This
increment applies no payment or order state transition.

## Deliberate limits

This ingress has no built-in scheduler; infrastructure invokes `processOne` or `processBatch`.
The separately documented payment-event application worker may now confirm PaymentAttempt and
Payment from these normalized events, but still adds no public Pix ingress, Order activation,
inventory operation, ledger posting, settlement, fulfillment, or production approval. In
particular, either Efí GET can never happen before its corresponding durable claim commit. See
[PROVIDER_PAYMENT_EVENT_APPLICATION.md](./PROVIDER_PAYMENT_EVENT_APPLICATION.md).
