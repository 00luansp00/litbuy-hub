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

`PRODUCT_IMAGE_S3_ENDPOINT` is the private backend endpoint used for HEAD and DELETE. `PRODUCT_IMAGE_S3_SIGNING_ENDPOINT` is the browser-reachable endpoint embedded in signed PUT/GET URLs and falls back to the internal endpoint when omitted. Local staging therefore uses `http://minio:9000` internally and `http://localhost:19000` for signing; browser responses must never expose `minio:9000`.

## Future

This foundation does **not** publish products or change `UNPUBLISHED`, expose a public catalog, enable buying, or connect checkout. A definitive CDN, thumbnails, transformations, specialized malware scanning, automatic moderation, public catalog, and purchase lifecycle remain future work.

## Current limitations

Physical cleanup can fail after the database tombstone and is retried by a repeated authenticated DELETE; broader reconciliation observability remains future work. Expired intentions are cleaned opportunistically rather than by a global scheduler. Content is validated from S3 metadata, not decoded or scanned. Production provider and CDN remain deliberately undecided.

## Reliability follow-up

Upload intentions now expire explicitly and are tombstoned opportunistically under the per-product transaction lock. Presigning happens before persistence, while ownership, active seller status, `UNPUBLISHED` status, capacity and order are revalidated in the transaction. Completion cannot revive deleted or expired metadata; invalid metadata is tombstoned before best-effort object cleanup. Deletion commits its tombstone, audit record and deterministic cover promotion before idempotent S3 cleanup. Seller and admin listings expose only short-lived signed GET URLs for READY images.

The seller's internal approved-listing screen includes upload progress, reload-safe signed previews, cover selection, ordering and deletion. It remains disconnected from public product routes, catalog, cart and checkout.

Presigned uploads require both `Content-Type` and `If-None-Match: *`; S3-compatible conditional creation prevents reuse of a still-valid URL from overwriting the validated object. Development and direct CI use MinIO Community with `MINIO_API_CORS_ALLOW_ORIGIN=http://localhost:3000`; local staging uses `http://localhost:13000`. The bucket remains private, browser access uses signed PUT/GET URLs, and DELETE remains an authenticated server-side operation. MinIO Community does not provide the same per-bucket CORS granularity here. The future production provider must receive an equivalent per-bucket policy, when supported, restricted to the official frontend origin, GET/PUT/HEAD, `Content-Type`, `If-None-Match`, and `ETag`; no AWS, R2, Wasabi, or other provider has been selected.
