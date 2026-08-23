# Buyer VIP fee — Q2

## CURRENT implementation

Q2 consumes typed, versioned `FeeRule` rows from the single effective `FeePolicyVersion` already locked for checkout. `BASIC` is the Owner baseline of 299 basis points and `PREMIUM` is 499 basis points; `NONE` applies no rule and charges zero. The runtime calculator, checkout, and frontend contain no rate fallback. Demo and test policies carry the baselines only as **LOCAL DEMO/TEST CONFIG — NOT A PRODUCTION SEED OR RUNTIME FALLBACK**. Operational production rollout requires an appropriately configured and published policy and remains M2 Admin/configuration scope; a missing, duplicate, or malformed paid-plan rule fails closed.

A canonical paid rule is `BUYER_SERVICE_FEE`, charged to `BUYER`, `PERCENT_BPS`, qualified only by typed `buyerVipPlan=BASIC|PREMIUM`. The calculation base is authoritative product value after discounts. CURRENT has no runtime discount authority and therefore this base equals subtotal. Integer minor-unit calculation uses `floor(base * percentBps / 10000)`.

## Buyer total, platform aggregate, and Seller invariance

Buyer total is net product plus Buyer VIP fee. Listing Tier and Seller MAX remain Seller-side and are not added to Buyer total. `platformFeeAmountMinor` prospectively aggregates Listing Tier, applicable Seller MAX, and applicable Buyer VIP in v3. Consequently `gross - platform aggregate` remains net product minus Seller-side fees: changing Buyer VIP never changes Seller proceeds.

New Orders use `feeSnapshotVersion=3`. They retain exactly one `LISTING_TIER`, zero/one `SELLER_MAX` according to the frozen Seller plan, and zero `BUYER_VIP` for `NONE` or exactly one for `BASIC|PREMIUM`. The BUYER_VIP row freezes policy/rule/public version, plan, rate, post-discount base, amount, currency, category, party, and formula. Legacy, v1, and v2 Orders are not backfilled or rerated; all snapshot fields remain immutable.

## Preview, checkout, payment, and Ledger

Cart preview returns each plan's server-authoritative rate, exact fee, final total, and monetary fingerprint. The fingerprint binds cart price, plan, policy/rule identity, public version, rate, base, fee, and total. Checkout resolves again inside its existing transaction; repricing produces `CHECKOUT_PREVIEW_CHANGED`, while idempotent replay never creates another Order or component. The client submits only plan and expected fingerprint.

Payment continues to charge the single `Order.totalAmountMinor`. Recognition validates v3 and its frozen components without rerating against a later active policy. Ledger uses the existing platform fee bucket: provider clearing is debited Buyer gross, Seller pending is credited product net of Seller-side fees, and platform is credited the complete component aggregate. Metadata decomposes Listing Tier, Seller MAX, and Buyer VIP.

## Separate capabilities / negative scope

Q2 implements only monetary charging and evidence. It does not implement VIP benefits, LIT Points, triage/refund/support SLAs (R1/R2/R3), refund/reversal/recovery, PSP split, Seller release acceleration, or M2 Admin CRUD/publication/UI. Future refund work may consume the frozen component but is not implemented here.
