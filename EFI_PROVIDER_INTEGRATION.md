# Efí provider integration boundary

## Scope and authentication

`backend/src/financial/providers/efi` implements `PaymentProviderPort` without exposing Efí DTOs to Order, Checkout, Ledger, or the domain. OAuth client-credentials authentication is isolated in the HTTP client; access tokens are memory-only and never logged or persisted. Mutating requests carry an idempotency key and every request carries a new correlation ID.

This is a sandbox foundation, not an activation. Checkout continues to create no real payment. There is no payout endpoint, Pix Cash-Out call, seller split, or irreversible webhook side effect.

## Sandbox and production configuration

The provider is off unless `EFI_ENABLED=true`. Sandbox and production use distinct Efí base URLs and must use separate credentials, webhook secrets, certificates, and private keys in the deployment secret manager. Required settings are:

| Setting                                        | Purpose                                                      |
| ---------------------------------------------- | ------------------------------------------------------------ |
| `EFI_ENVIRONMENT`                              | exactly `sandbox` or `production`                            |
| `EFI_CLIENT_ID`, `EFI_CLIENT_SECRET`           | OAuth client credentials                                     |
| `EFI_MTLS_CERTIFICATE`, `EFI_MTLS_PRIVATE_KEY` | secret-manager-injected PEM material                         |
| `EFI_WEBHOOK_SECRET`                           | webhook authenticity boundary secret                         |
| `EFI_TIMEOUT_MS`                               | 1–30 second outbound timeout                                 |
| `EFI_API_BASE_URL`                             | optional HTTPS override                                      |
| `EFI_PRODUCTION_APPROVED`                      | explicit production gate; not evidence of approval by itself |

Enabled configuration is validated during Nest configuration startup. Production additionally fails closed unless `EFI_PRODUCTION_APPROVED=true`; deployment governance must set it only after written Efí homologation. No secret, certificate, key, or token belongs in Git, a database, an event payload, or application logs.

## Certificates and transport security

Outbound HTTPS uses the configured client certificate/private key, validates the server certificate, and has a finite timeout. Efí Pix webhook mTLS, where applicable to the contracted endpoint, must terminate at a trusted ingress configured to require and validate Efí's client certificate. The ingress must pass only verified traffic to the application; the application then performs payload authentication and parsing. Exact production CA/certificate rotation is pending homologation.

No PAN or CVV is accepted by this adapter. Future cards must use provider-hosted tokenization; complete card data must never traverse or persist in LIT Buy.

## Payment and webhook mapping

Efí `new`/`waiting` map to `PENDING`; `identified`/`paid`/`approved` to `SUCCEEDED`; `unpaid` to `FAILED`; and `canceled`/`expired` to `EXPIRED`. Unknown states fail closed and open a reconciliation concern rather than guessing.

Webhook JSON is strictly reduced to an external event ID, event type, charge ID, mapped state, and SHA-256 payload hash (`ProviderWebhook`). The stable external ID and hash support the existing idempotency/reconciliation boundary: duplicate delivery is not a second financial instruction, arrival order is never trusted, and no fixture/parser path writes ledger entries.

## Errors, retries, and reconciliation

HTTP and transport failures become bounded adapter errors. Authentication and invalid requests are non-retryable; throttling may be retried only by an explicitly designed read-safe policy. A timeout, connection loss, malformed/unknown response, or 5xx after a mutable request is ambiguous and requires reconciliation. The adapter does **not** blindly retry financial mutations.

Logs and operator errors contain normalized codes and optional provider correlation IDs, never response bodies, authorization headers, credentials, certificates, private keys, access tokens, or full payment instrument data.

## Marketplace risk foundation

Efí remains the regulated financial layer; LIT Buy does not build a bank or standalone AML system. Marketplace withdrawal decisions will require KYC and same-titularity destination, forbid third-party payouts, and require step-up plus cooldown after a destination change. A deficit or blocked/restricted seller cannot withdraw; disputes and chargebacks may block balance.

Signals prepared for future manual review include abnormal volume, related accounts/devices, rapid money entry/exit, self-purchase or self-dealing, and abnormal refund/chargeback rates. These signals do not autonomously confiscate or move funds.

The PR #39 withdrawal policy remains unchanged: `STANDARD`, up to 48 hours, manual approval, zero fee; `INSTANT` remains disabled.

## Decisions pending written homologation

Before production, Efí must confirm in writing the real catalog and receipt/repayment structure, contractual custody/hold implications, supported refund and chargeback behavior, marketplace/seller KYC responsibilities, webhook mTLS/signature contract and certificate rotation, payment endpoint/field versions, idempotency guarantees, reconciliation reports, rate limits, and the future Pix Cash-Out flow with same-titularity enforcement. Native seller split is not the currently planned settlement path.
