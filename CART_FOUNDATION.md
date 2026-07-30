# Persistent buyer cart foundation (PR #36)

Status: implemented backend foundation.

## Scope and invariants

`Cart` is owned by one authenticated buyer and one seller. A partial unique index permits at most one `ACTIVE` cart for that pair. `CartItem` stores only product/variant references and quantity (1–999); it stores no price, subtotal, fee, snapshot, reservation, order, checkout, or payment state. A cart remains active and versioned when its last item is removed. There is a maximum of 50 lines.

The database enforces active-cart and line uniqueness, `version >= 1`, quantity bounds, and the product/variant pair through a composite foreign key. Mutations run in a Prisma transaction, acquire a transaction-scoped advisory lock for buyer and seller, use a conditional version update, and write a minimal `SecurityEvent` in the same transaction.

## HTTP contract

All routes require `AccessTokenGuard`, `PlatformRolesGuard`, and `BUYER`; every lookup includes the current `buyerUserId`. GET `/api/v1/carts` accepts `page` (default 1) and `limit` (default 20, max 50). GET `/api/v1/carts/:sellerSlug` returns one active cart. POST `/api/v1/carts/:sellerSlug/items`, PATCH `/api/v1/carts/:sellerSlug/items/:itemId`, and DELETE on the same item route require the persisted-session double-submit CSRF contract.

POST accepts product, optional variant, quantity, and `expectedVersion`. Version zero means the caller observed no active cart; the initial cart returns version one. Existing-cart POST, PATCH, and DELETE require the exact current version and increment once. Conflicts return `CART_VERSION_CONFLICT` with the current version. Duplicate selections are not merged.

## Purchasability and reconciliation

NORMAL uses product price/stock and rejects a variant. DYNAMIC requires an active matching variant and uses its price/stock. FIXED service requires quantity one and uses base price. QUOTE is rejected. Self-purchase is rejected. Product publication, approved origin, active taxonomy/seller, public cover, seller match, price, and current stock are checked; cart operations never decrement or reserve stock.

Reads are non-mutating and reconcile current catalog state. Public issues include product/variant unavailable, stock/quantity unavailable, price unavailable, and quote-required. Prices are converted deterministically from Decimal to `bigint` minor units and emitted as decimal strings. A subtotal is returned only if every line is currently valid; it is a non-authoritative preview and checkout must revalidate.

## Errors and audit

Domain errors include `CART_NOT_FOUND`, `CART_ITEM_NOT_FOUND`, `CART_VERSION_CONFLICT`, `CART_ITEM_ALREADY_EXISTS`, `CART_ITEM_LIMIT_REACHED`, `PRODUCT_NOT_PURCHASABLE`, `PRODUCT_REQUIRES_QUOTE`, variant errors, `INSUFFICIENT_STOCK`, and `SELF_PURCHASE_NOT_ALLOWED`. Audit metadata is limited to identifiers, quantities, versions, and action; request payloads, personal data, credentials, tokens, cookies, CSRF, storage keys, and private prices are excluded.

## Tests, risks, and next step

The dedicated suites are `cart-pricing.spec.ts`, `cart-purchasability.spec.ts`, `carts.service.spec.ts`, `carts.e2e-spec.ts`, and `carts.integration-spec.ts`. Unit coverage verifies exact minor-unit conversion, JSON strings, reuse of public publication eligibility, selection-specific rules, safe reconciliation, and response minimization. The HTTP suite exercises authentication, CSRF, DTO validation, and the public route contract. The PostgreSQL suite behaviorally exercises the partial active-cart index, both partial line indexes, quantity/version checks, and the composite product-variant foreign key. Successful CI execution remains the authority for PostgreSQL-backed evidence; this document does not treat unrelated integration tests as proof.

Remaining risks include catalog changes between cart and future checkout and operational contention. Cart operations never reserve or decrement inventory, and the preview is not an authoritative price. Checkout, orders, and payments do not exist in this foundation. PR #37 is the next incremental commerce step, but must preserve the frozen order/payment boundary and add no real money until its prerequisites are approved.
