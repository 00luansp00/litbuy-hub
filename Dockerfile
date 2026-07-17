FROM oven/bun:1.2.23 AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM oven/bun:1.2.23 AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG VITE_API_BASE_URL=http://localhost:3001/api/v1
ARG VITE_CURRENT_TERMS_VERSION=2026-07-14
ARG VITE_CURRENT_PRIVACY_VERSION=2026-07-14
ARG VITE_ENABLE_DEMO_ROLES=false
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_CURRENT_TERMS_VERSION=$VITE_CURRENT_TERMS_VERSION
ENV VITE_CURRENT_PRIVACY_VERSION=$VITE_CURRENT_PRIVACY_VERSION
ENV VITE_ENABLE_DEMO_ROLES=$VITE_ENABLE_DEMO_ROLES
RUN bun run build

FROM oven/bun:1.2.23-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/.output ./.output
USER bun
EXPOSE 3000
CMD ["bun", ".output/server/index.mjs"]
