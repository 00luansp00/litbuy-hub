# Product Image Storage Foundation

## Real

Product images are private internal product metadata. Sellers with an active profile can create an upload intent, upload JPEG/PNG/WebP directly through a short-lived S3-compatible presigned `PUT`, and ask the API to verify the object with `HEAD`. The API owns UUIDs and keys, enforces 5 MiB and eight-image limits, persists explicit `PENDING_UPLOAD`, `READY`, and `DELETED` states, and never persists a provider URL.

Ready images can be listed, reordered, selected as cover, and deleted. PostgreSQL advisory locks serialize each product's mutations; checks and a partial unique index are final database barriers. Admin access is read-only. Security events contain identifiers and safe metadata, never credentials or signed URLs.

### API

- `POST /api/v1/seller/products/:productId/images/upload-intents`
- `POST /api/v1/seller/products/:productId/images/:imageId/complete`
- `GET /api/v1/seller/products/:productId/images`
- `PATCH /api/v1/seller/products/:productId/images/reorder`
- `PATCH /api/v1/seller/products/:productId/images/:imageId/cover`
- `DELETE /api/v1/seller/products/:productId/images/:imageId`
- `GET /api/v1/admin/products/:productId/images`

### Local storage

Copy `backend/.env.example`, then run `docker compose -f backend/compose.yaml up -d`. Compose starts PostgreSQL, Redis, MinIO, waits for MinIO health, and idempotently creates `litbuy-product-images`. Test credentials are development-only. To clean objects and databases, use `docker compose -f backend/compose.yaml down -v`.

Required configuration is `PRODUCT_IMAGE_S3_ENDPOINT`, `PRODUCT_IMAGE_S3_REGION`, `PRODUCT_IMAGE_S3_BUCKET`, `PRODUCT_IMAGE_S3_ACCESS_KEY`, `PRODUCT_IMAGE_S3_SECRET_KEY`, `PRODUCT_IMAGE_S3_FORCE_PATH_STYLE`, and `PRODUCT_IMAGE_UPLOAD_URL_TTL_SECONDS`. `PRODUCT_IMAGE_PUBLIC_BASE_URL` is reserved and optional.

## Future

This foundation does **not** publish products or change `UNPUBLISHED`, expose a public catalog, enable buying, or connect checkout. A definitive CDN, thumbnails, transformations, specialized malware scanning, automatic moderation, public catalog, and purchase lifecycle remain future work.

## Current limitations

Object deletion precedes the database tombstone, so a transient database failure can require reconciliation. Pending intents need a future expiry/garbage-collection worker. Content is validated from S3 metadata, not decoded or scanned. Production provider and CDN remain deliberately undecided.
