# Efí provider integration boundary

## Scope

`backend/src/financial/providers/efi` is a sandbox boundary. Payment operations implement the provider-neutral `PaymentProviderPort`; external-event resolution implements the separate provider-neutral `PaymentProviderNotificationPort`. Efí DTOs do not enter Order, Checkout, Ledger, or domain services. A feature-gated Billing callback now persists a durable provider-neutral inbox before asynchronous resolution. No Pix callback, real checkout payment, Pix transfer, cash-out, payout, seller split, refund, or irreversible ledger effect is enabled.

## Separate Billing and Pix profiles

The APIs are different protocols and never share a configurable arbitrary host:

| Profile             | Sandbox/homologation                    | Production                            | OAuth                |
| ------------------- | --------------------------------------- | ------------------------------------- | -------------------- |
| Cobranças (Billing) | `https://cobrancas-h.api.efipay.com.br` | `https://cobrancas.api.efipay.com.br` | `POST /v1/authorize` |
| Pix                 | `https://pix-h.api.efipay.com.br`       | `https://pix.api.efipay.com.br`       | `POST /oauth/token`  |

Production accepts only its pinned official hosts. Explicit URL overrides exist only for local/test transports and cannot be used with the production environment. Billing OAuth uses client credentials over HTTPS; this boundary does not claim Billing requires an outbound client certificate. Pix requires its separately injected client certificate/private key and server-certificate validation. Access tokens remain memory-only.

The provider is off unless `EFI_ENABLED=true`. Enabled startup requires `EFI_CLIENT_ID`, `EFI_CLIENT_SECRET`, `EFI_PIX_MTLS_CERTIFICATE`, `EFI_PIX_MTLS_PRIVATE_KEY`, and a 1–30 second timeout. `EFI_PRODUCTION_APPROVED=true` is an additional fail-closed deployment gate, not proof of homologation. Sandbox and production credentials and certificates must be entirely separate and secret-manager injected. Secrets, tokens, certificates, and keys must never enter Git, persistence, payload logs, or error messages.

## Billing charge contract

Create and detail responses use `{ code, data: { charge_id, status, total, ... } }`; `ProviderPayment.id` comes from `data.charge_id`. Positive minor-unit `bigint` amounts are range-checked before conversion, and values above `Number.MAX_SAFE_INTEGER` are rejected before network access. Creation sends the stable internal reference in `metadata.custom_id` for later reconciliation.

The Billing API's undocumented `x-idempotency-key` is not sent or assumed. LIT Buy still requires internal idempotency. A timeout or connection loss following a mutation is ambiguous, is never blindly retried, and requires reconciliation.

Cancel is read-after-write: `PUT /v1/charge/:id/cancel`, followed by authenticated `GET /v1/charge/:id`. An ambiguous PUT or unreliable confirmation requires reconciliation. In particular, a canceled boleto may later be reported as `paid`; a late notification must not blindly reactivate an Order and must go through the future idempotent reconciliation/state-machine workflow.

Status mapping is deliberately conservative:

- `new`, `waiting`, `identified`, `approved`, `link` → `PENDING`;
- `paid` → `SUCCEEDED`;
- `unpaid` → `FAILED`;
- `canceled`, `expired` → `EXPIRED`.

`refunded`, `contested`, and `settled` carry financial semantics that the simple payment state cannot preserve. They fail closed with reconciliation required until refund, dispute/chargeback, and settlement domain flows consume them explicitly.

## Billing notification token resolution

Efí Billing posts `application/x-www-form-urlencoded` containing `notification=<token>`. The adapter strictly parses that callback, then performs authenticated `GET /v1/notification/:token`. The returned `{ code, data: [...] }` history contains event `id`, `type`, current/previous status, `identifiers.charge_id`, and creation time. Only supported `charge` events become provider-neutral events.

The token identifies the lifecycle, not one delivery. Each normalized external ID is a deterministic SHA-256 of provider, protocol, token, and notification event ID. Thus two lifecycle changes have different IDs while a redelivery of the same history event has the same ID. Raw notification tokens are not returned to the domain or logged. Arrival order is never authoritative, and resolution itself performs no financial write.

Calling `GET /v1/notification/:token` tells Efí that the notification was received. The public Billing callback therefore **does not call this resolver**. It first commits an encrypted-token delivery to `ProviderNotificationInbox`; only the separate worker may resolve the authenticated notification history. This ordering permits local retries even if Efí already considers the token consulted. Inbox and normalized-event processing are idempotent, and `ProviderWebhookEvent` plus any later financial processing stays subsequent and transactional.

The raw token never appears in logs or persistence. AES-256-GCM protects recoverable token material with an injected, identified key; SHA-256 is stored only for technical correlation. See [PROVIDER_NOTIFICATION_INGRESS.md](./PROVIDER_NOTIFICATION_INGRESS.md). No ledger consumer or financial effect is included.

## Pix webhook boundary

Pix callbacks are JSON shaped as `{ pix: [...] }`, with entries including `endToEndId`, `txid`, `valor`, and `horario`. This parser is separate from Billing notification resolution. It does not invent or require a body-HMAC signature.

Only an unambiguous received Pix without refund/outbound lifecycle markers is normalized as `PIX_RECEIVED`. The shared `{ pix: [...] }` envelope may also contain `devolucoes`; refund/devolution markers and known outbound/Pix Cash-Out markers fail with `UNSUPPORTED_PROVIDER_EVENT` and `requiresReconciliation=true`. They are never mislabeled as a successful receipt, discarded, translated into an invented refund state, or connected to the ledger in this boundary.

Authenticity depends first on mTLS at a trusted ingress that validates Efí's client certificate. Until that infrastructure exists, callers must provide explicit internal `transportVerified=true`; otherwise the adapter rejects the payload. Additional IP or URL-HMAC controls remain subject to current official documentation and written homologation. The parser creates no payment or ledger effect.

## Refunds and reconciliation

Generic `refundPayment` is explicitly `UNSUPPORTED_OPERATION` and performs no network call. Card reversal is method-specific and asynchronous, Pix uses its own refund mechanism, and boleto does not share that contract. A future increment must first connect PaymentAttempt/payment-method data and sufficient external identifiers, then model pending outcomes and reconcile the correct method-specific API.

Transport retry classification is method-aware. A failed `GET` may be retryable because repeating a read creates no provider-side financial effect. A timeout, connection loss, 429, or 5xx affecting a `POST`/`PUT` is non-retryable and reconciliation-required unless a future documented contract proves the mutation was not executed. No mutation is blindly repeated and no undocumented provider idempotency header is assumed.

Normalized operator errors expose only stable codes and optional correlation IDs. They never contain response bodies, authorization headers, client secrets, access tokens, notification tokens, certificates, private keys, PAN, or CVV.

## Marketplace risk ownership

Provider-independent policy lives in `backend/src/financial/risk/marketplace-withdrawal-risk-policy.ts`, not in the Efí adapter. It is only a policy foundation—not implemented AML/KYC automation. LIT Buy owns marketplace-specific seller eligibility, related account/device and self-dealing signals, abnormal behavior, balance release, deficits, and withdrawal approval. KYC before withdrawal, same-titularity destination, third-party payout prohibition, and destination-change step-up/cooldown remain planned controls.

Efí is the regulated financial institution. Financial antifraud and PLD-FT controls are Efí responsibilities where the future contract and law assign them; LIT Buy does not claim to replace those controls or operate a bank.

The PR #39 policy remains unchanged: `STANDARD`, up to 48 hours, manual approval, zero fee; `INSTANT` remains disabled.

## Commercial gate

Production remains blocked until Efí confirms in writing the real LIT Buy catalog and receipt/repayment model, responsibilities for KYC/PLD-FT and fraud, notification and Pix ingress controls, certificate rotation, method-specific refunds, chargebacks, reconciliation reports, and the future same-titularity Pix Cash-Out flow. Native seller split is not the planned primary settlement path.
