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
ENV NITRO_PRESET=node-server
RUN bun run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
COPY --from=build --chown=node:node /app/.output ./.output
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --retries=5 CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", ".output/server/index.mjs"]
