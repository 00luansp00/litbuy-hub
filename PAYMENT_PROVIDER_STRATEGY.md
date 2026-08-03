# Payment provider strategy

Efí Bank is the selected primary PSP for the MVP, subject to commercial homologation. The financial domain remains provider-agnostic behind `PaymentProviderPort`; Efí DTOs, authentication, certificates, and errors stay inside its adapter. PagBank, Asaas, and Pagar.me remain future alternatives rather than active integrations.

## Settlement decision

Efí native split is **not** the primary seller-settlement design. The planned flow is payment confirmation at Efí, internal allocation and hold in the LIT Buy ledger, release from `HELD` to `AVAILABLE`, a seller's standard withdrawal request, reservation, manual approval, and only then a future Pix Cash-Out operation. This boundary does not enable checkout payments, payouts, Pix Cash-Out, or seller split.

LIT Buy remains authoritative for its ledger, fees/commissions, `PENDING`, `HELD`, `AVAILABLE`, `RESERVED`, `DEFICIT`, release and withdrawal rules, and marketplace risk. Efí is expected to execute external regulated financial operations and report their outcomes; provider events never become a second source of truth.

## Mandatory commercial gate

Production remains blocked until Efí provides written homologation for both the receipt/repayment model and LIT Buy's real catalog. The catalog includes game accounts, virtual currencies, skins, digital items, boost/powerlevel, keys, software/licenses, gift cards, and digital services. Approval, custody/retention support, refunds, chargebacks, KYC, Pix, boleto, cards, and the future cash-out model must not be assumed.

The current adapter is a sandbox/boundary foundation only. Billing notifications and Pix webhooks use distinct provider-neutral resolution paths; generic refunds and payouts remain unsupported. Any production enablement requires the explicit configuration gate, written approval, operational runbooks, reconciliation monitoring, and a separately reviewed release.
