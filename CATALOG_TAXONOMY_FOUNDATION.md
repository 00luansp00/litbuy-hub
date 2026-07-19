# Catalog taxonomy foundation

Status: implemented as the first persistent catalog taxonomy foundation. It does not make the commercial catalog complete.

## Real in this foundation

- Persistent `CatalogCategory`, `CatalogSubcategory` and `CatalogAttribute` records in PostgreSQL.
- `CatalogEntityStatus`, `CatalogProductType` and `CatalogAttributeInputType` enums.
- Public read API for active categories, active subcategories, product types and resolved attributes.
- Admin API protected by `AccessTokenGuard`, `PlatformRolesGuard` and `@RequireRoles(ADMIN)`.
- Sort order, active/inactive status and category featured flag.
- Baseline migration with the existing public categories, wizard subcategories and current attribute configs for League of Legends, Valorant, Free Fire and virtual currency.
- Audit events for create/update/status changes, written in the same transaction as the administrative mutation.

## Still demonstrative/mock

- Products, listings, prices, images, inventory, reviews, displayed sellers, search, promotions, plans, uploads and publishing.
- `/produto/$id` remains a demonstrative product page.
- `/vendedor/anuncios/novo` consumes real taxonomy, but draft submission remains demonstrative and publishes nothing.

## Public subcategory contract

Public subcategory responses are minimal (`id`, `slug`, `name`, `sortOrder`) and do not expose status, timestamps, categoryId, administrative metadata or fictitious metrics.

## Attribute resolution

When `/api/v1/catalog/attributes` receives a product type and subcategory, the backend loads active generic product-type attributes and active subcategory attributes. Subcategory attributes override generic attributes with the same `key`. The final result is ordered by `sortOrder ASC` and then `key ASC` for deterministic ties. The frontend must not merge attribute scopes by itself.

## Validation and safety

Slugs are trimmed, lowercase, 2-60 characters, `a-z`, `0-9` and hyphen only, with no edge or consecutive hyphens and reserved route words rejected. Names and descriptions are normalized as plain text. Icons use a central Lucide allowlist. Colors accept only `#RRGGBB`. Select options are unique, normalized and required only for `SELECT`. Attribute scope is enforced with a PostgreSQL XOR check constraint plus partial unique indexes for per-subcategory and per-product-type keys.

## Temporary risks

Subcategories can still be moved between categories and attribute keys can still be changed because there are no persistent listings yet. Both must be restricted before real products/listings are introduced.
