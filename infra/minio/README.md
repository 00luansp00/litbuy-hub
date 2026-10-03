# Pinned MinIO Community images for local infrastructure

LIT Buy builds MinIO Community and its `mc` client directly from their official archived source repositories. The public Community container repositories are no longer an available dependency. These images are exclusively for CI, development, and local staging rehearsal; they do not select or approve a production object-storage provider.

## Pinned sources

| Component | Official source                      | Release                        | Verified commit                            | Toolchain                                                                                                                          |
| --------- | ------------------------------------ | ------------------------------ | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| Server    | `https://github.com/minio/minio.git` | `RELEASE.2025-10-15T17-29-55Z` | `9e49d5e7a648f00e26f2246f4dc28e6b07f8c84a` | `golang:1.24.8-bookworm` (`sha256:4ed690d6649d63c312b99a6120025ec79ce3b542968a37da53d6236c7c61a848`)                               |
| Client    | `https://github.com/minio/mc.git`    | `RELEASE.2025-08-13T08-35-41Z` | `7394ce0dd2a80935aded936b09fa12cbb3cb8096` | `golang:1.24.8-bookworm` (`sha256:4ed690d6649d63c312b99a6120025ec79ce3b542968a37da53d6236c7c61a848`; upstream declares Go 1.23.10) |

Both runtime targets use `debian:12.12-slim` pinned to `sha256:d5d3f9c23164ea16f31852f95bd5959aad1c5e854332fe00f7b3a20fcc9f635c`. The Dockerfile downloads each official GitHub archive by commit SHA and fails unless its SHA-256 equals the recorded checksum (`45521908307306e925c98d629e1c17d78c8b72b6ee242b1bfb1409f7d8ee5841` for MinIO and `95cd293c7119f16921a6dc515a1fb74a2227f19fd994b9c8b770a154e802ac44` for `mc`). The documented tags were independently resolved to those commits through the GitHub API. It compiles unmodified upstream source, copies the upstream `LICENSE` and `NOTICE` into the runtime image, and performs no network access at container startup.

Build the targets from the repository root:

```sh
docker build --target server -t litbuy/minio-community:RELEASE.2025-10-15T17-29-55Z infra/minio
docker build --target client -t litbuy/minio-mc:RELEASE.2025-08-13T08-35-41Z infra/minio
```

MinIO Community is AGPLv3 and upstream is archived/source-only. AIStor and third-party mirrors are deliberately not used. Production remains `HUMAN_PROD_REVIEW` for legal, security, maintenance, and provider selection; this local build is not production-ready.
