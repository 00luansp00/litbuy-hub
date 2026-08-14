# CSRF and session threat model

This document records the human-approved cookie decision for remediation of `P3-F1`. It does not
close `P3-F10` or replace the findings Ledger.

## Security boundary

Protected assets include the authenticated session and refresh token, Buyer cart/checkout/payment
and order mutations, Seller fulfillment and listing mutations, Admin mutations, and sensitive
account changes.

The CSRF attacker is a third-party malicious site inducing an authenticated user's browser to send
cross-site requests with automatically attached cookies, without access to the CSRF token. CSRF
protection does not address XSS, a compromised browser, credential or access-token theft, or session
database/pepper compromise. In particular, XSS in the SPA can read the JavaScript-readable CSRF
cookie and the in-memory Bearer access token.

The access token remains a Bearer token held in frontend memory and is not automatically attached by
the browser. The refresh token remains an HttpOnly cookie. Cookie-authenticated refresh/logout and
the existing protected critical mutations retain double-submit validation: the CSRF cookie must
equal `X-CSRF-Token`, and its HMAC must match the authenticated Session.

## Supported origin topologies

- Same origin, with host-only cookies.
- Same host on different ports, with host-only cookies; ports do not isolate cookies.
- Same-site frontend/API subdomains, with an explicitly configured compatible parent `Domain`.

Cross-site cookie authentication is not supported by the current model. It requires a separately
approved non-cookie CSRF transport and is rejected by environment validation.

## Cookie contract

| Purpose | HttpOnly | Path           | Other attributes and lifetime                                                               |
| ------- | -------- | -------------- | ------------------------------------------------------------------------------------------- |
| Refresh | Yes      | `/api/v1/auth` | Existing configurable name, Secure, SameSite, Domain, and refresh TTL                       |
| CSRF    | No       | `/`            | Existing configurable name, Secure, SameSite, Domain, and refresh TTL; rotated with refresh |
| Device  | Yes      | `/api/v1/auth` | Existing configurable name, Secure, SameSite, Domain, and 400-day lifetime                  |

Setting or rotating auth cookies also expires the legacy CSRF cookie at `/api/v1/auth`. Auth clear
expires both the current root-path CSRF cookie and that legacy variant. Normal logout does not clear
the device cookie.

`P3-F10` remains **OPEN**: the project-wide policy deciding which Bearer-authenticated mutations must
also receive CSRF defense in depth, and consolidation of duplicated guards, require separate human
review and documentation.
