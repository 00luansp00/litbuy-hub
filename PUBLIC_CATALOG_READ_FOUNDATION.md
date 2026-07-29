# Public catalog read foundation

> O dataset descrito em `LOCAL_DEMO_DATA.md` permite validar esta leitura com seis produtos ativos. A listagem da Home agora consome o endpoint; detalhe, categorias, busca e comércio continuam desconectados, conforme `HOME_PUBLIC_CATALOG_INTEGRATION.md`.

## Endpoints

The backend exposes read-only, unauthenticated `GET /api/v1/catalog/products` and `GET /api/v1/catalog/products/:slug`. They read materialized products; they do not make an item purchasable, reserve stock, mutate data, or write security/audit events. The public frontend is not connected yet.

## List query and pagination

The strict query accepts `categorySlug`, `subcategorySlug`, `productType`, `sort`, `page` (1–100, default 1), and `limit` (1–50, default 24). Sort is `RECENT` (default), `OLDEST`, `TITLE_ASC`, or `TITLE_DESC`; every order includes `id` as a deterministic tie-breaker. Text search is absent.

PostgreSQL first filters active products, sellers and taxonomy, approved source drafts, a ready cover, and requested filters. Batches are then evaluated using the same pure publication rules as `ACTIVATE`/`RESUME`. Only eligible rows count toward the logical offset. The response contains `items` and `{ page, limit, hasNext }`, with no `total`.

## Visibility boundary

Visibility requires an `ACTIVE` product and seller, an `APPROVED` source draft with identical category/subcategory/type, active and consistent taxonomy, valid content, exactly one ready cover, and all current model/variant/price/stock/service publication rules. A missing or ineligible detail is the same `404 PRODUCT_NOT_FOUND`; internal eligibility codes are never disclosed.

## Public contracts

Cards expose only product id/slug/title/normalized 160-character summary, type/model, decimal-string pricing (`FIXED`, `FROM`, or `QUOTE`), informative stock, public taxonomy and seller names/slugs, and the signed cover. Details add description, delivery mode, active ordered variants, ordered ready gallery, and safe service pricing/delivery fields. Explicit mapping excludes Prisma records, private IDs, keys, account data, notes, automated messages, administrative state, and invented metrics.

## Private images

The bucket remains private. After eligibility succeeds, the service calls the existing `ProductImageStorage.createReadUrl` abstraction. Lists sign only the cover; details sign only ready images. Responses contain URL, ISO expiry and alt text, never `objectKey`; URLs are neither assembled nor persisted by catalog code.

## Security, limitations, and out of scope

Both routes are GET-only and require neither bearer token nor CSRF token. They have no mutation, mock fallback, or direct S3 client. Signed URLs are time-limited; pagination is capped and provides neither search nor a total. Frontend integration, search/FTS, reviews, favorites, cart, coupons, orders, checkout, payments, reservation, escrow/wallet, delivery, chat/disputes, image transformation/CDN/cache, and lifecycle mutation remain future work.

## Automated coverage

`public-product-catalog.service.spec.ts` exercises the service itself with controlled Prisma and
storage collaborators in addition to its pure mapping helpers. The Backend integration suite now
contains three catalog-specific paths:

- `public-product-catalog-http-controlled.integration-spec.ts` starts the real Nest application and
  uses PostgreSQL plus controlled signing to cover anonymous HTTP access, every visibility barrier,
  filters and validation, deterministic ordering, logical pagination, safe contracts, gallery and
  variant selection, signature counts, safe storage failures, and absence of security events;
- `public-product-catalog.integration-spec.ts` exercises three pages and persisted eligibility
  changes directly against PostgreSQL, including interleaved invisible rows and ID tie-breaks;
- `public-product-catalog-minio.integration-spec.ts` uploads and downloads a real private object
  through the existing storage abstraction and verifies the configured signed host and subsequent
  invisibility.

These infrastructure tests require the PostgreSQL, Redis, and MinIO services supplied by Backend
integration CI. Their presence does not imply that the public frontend consumes the API.

## Catálogo público por categoria

A rota `/categoria/$slug` usa produtos e subcategorias públicos reais, com filtros suportados e paginação sem total. Detalhe e comércio continuam desconectados. Consulte `CATEGORY_PUBLIC_CATALOG_INTEGRATION.md`.
