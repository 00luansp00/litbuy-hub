# Payment provider strategy

The financial domain is provider-agnostic behind `PaymentProviderPort`. PR #39 contains only a deterministic, network-free fake; it installs no PSP SDK, sends no external request, and moves no real money.

The non-binding shortlist is PagBank (current technical candidate A), Asaas (candidate B), Pagar.me (strong scale/future candidate), and Efí (under commercial/technical validation, including precedent in similar marketplaces). None is contracted, approved, or homologated.

## Mandatory commercial gate

No real adapter may reach production without written confirmation from the selected PSP covering marketplace/subaccounts/recipients, individuals and companies, split, retention/custody/hold, platform commission, Pix, boleto, cards, withdrawals, KYC, refund, chargeback, negative balances, regulatory homologation, and LIT Buy's real catalog. The catalog includes game accounts, virtual currencies, skins, digital items, boost/powerlevel, keys, software/licenses, gift cards, and digital services. Contractual approval must never be assumed.

The next increment is a sandbox adapter only after formal commercial selection, followed as dependencies permit by account/KYC/hold, charge creation and attempts, webhooks, settlement/release, reconciliation, withdrawals, refunds, chargebacks/deficit, admin, and frontend capabilities.
