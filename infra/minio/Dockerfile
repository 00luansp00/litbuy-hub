ARG GO_IMAGE=golang:1.24.8-bookworm@sha256:4ed690d6649d63c312b99a6120025ec79ce3b542968a37da53d6236c7c61a848
ARG RUNTIME_IMAGE=debian:12.12-slim@sha256:d5d3f9c23164ea16f31852f95bd5959aad1c5e854332fe00f7b3a20fcc9f635c

FROM ${GO_IMAGE} AS minio-build
ARG MINIO_COMMIT=9e49d5e7a648f00e26f2246f4dc28e6b07f8c84a
ARG MINIO_ARCHIVE_SHA256=45521908307306e925c98d629e1c17d78c8b72b6ee242b1bfb1409f7d8ee5841
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl \
 && rm -rf /var/lib/apt/lists/* \
 && curl --fail --location --retry 3 \
      "https://github.com/minio/minio/archive/${MINIO_COMMIT}.tar.gz" -o /tmp/minio.tar.gz \
 && echo "${MINIO_ARCHIVE_SHA256}  /tmp/minio.tar.gz" | sha256sum --check --strict \
 && mkdir -p /src/minio \
 && tar --extract --gzip --file /tmp/minio.tar.gz --strip-components=1 --directory /src/minio \
 && rm /tmp/minio.tar.gz
WORKDIR /src/minio
RUN mkdir -p /out \
 && CGO_ENABLED=0 go build -tags kqueue -trimpath \
      -ldflags='-s -w -X github.com/minio/minio/cmd.Version=2025-10-15T17:29:55Z -X github.com/minio/minio/cmd.CopyrightYear=2025 -X github.com/minio/minio/cmd.ReleaseTag=RELEASE.2025-10-15T17-29-55Z -X github.com/minio/minio/cmd.CommitID=9e49d5e7a648f00e26f2246f4dc28e6b07f8c84a -X github.com/minio/minio/cmd.ShortCommitID=9e49d5e7a648' \
      -o /out/minio .

FROM ${GO_IMAGE} AS mc-build
ARG MC_COMMIT=7394ce0dd2a80935aded936b09fa12cbb3cb8096
ARG MC_ARCHIVE_SHA256=95cd293c7119f16921a6dc515a1fb74a2227f19fd994b9c8b770a154e802ac44
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl \
 && rm -rf /var/lib/apt/lists/* \
 && curl --fail --location --retry 3 \
      "https://github.com/minio/mc/archive/${MC_COMMIT}.tar.gz" -o /tmp/mc.tar.gz \
 && echo "${MC_ARCHIVE_SHA256}  /tmp/mc.tar.gz" | sha256sum --check --strict \
 && mkdir -p /src/mc \
 && tar --extract --gzip --file /tmp/mc.tar.gz --strip-components=1 --directory /src/mc \
 && rm /tmp/mc.tar.gz
WORKDIR /src/mc
RUN mkdir -p /out \
 && CGO_ENABLED=0 go build -tags kqueue -trimpath \
      -ldflags='-s -w -X github.com/minio/mc/cmd.Version=2025-08-13T08:35:41Z -X github.com/minio/mc/cmd.CopyrightYear=2025 -X github.com/minio/mc/cmd.ReleaseTag=RELEASE.2025-08-13T08-35-41Z -X github.com/minio/mc/cmd.CommitID=7394ce0dd2a80935aded936b09fa12cbb3cb8096 -X github.com/minio/mc/cmd.ShortCommitID=7394ce0dd2a8' \
      -o /out/mc .

FROM ${RUNTIME_IMAGE} AS runtime-base
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl \
 && rm -rf /var/lib/apt/lists/* \
 && groupadd --system --gid 10001 minio \
 && useradd --system --uid 10001 --gid minio --home-dir /nonexistent --shell /usr/sbin/nologin minio

FROM runtime-base AS server
COPY --from=minio-build /out/minio /usr/local/bin/minio
COPY --from=minio-build /src/minio/LICENSE /usr/share/licenses/minio/LICENSE
COPY --from=minio-build /src/minio/NOTICE /usr/share/licenses/minio/NOTICE
RUN mkdir -p /data && chown minio:minio /data
USER minio:minio
VOLUME ["/data"]
EXPOSE 9000 9001
ENTRYPOINT ["/usr/local/bin/minio"]
CMD ["server", "/data", "--console-address", ":9001"]

FROM runtime-base AS client
COPY --from=mc-build /out/mc /usr/local/bin/mc
COPY --from=mc-build /src/mc/LICENSE /usr/share/licenses/mc/LICENSE
COPY --from=mc-build /src/mc/NOTICE /usr/share/licenses/mc/NOTICE
USER minio:minio
ENTRYPOINT ["/usr/local/bin/mc"]
