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
RUN mkdir -p dist && cp -R .output/public/. dist/

FROM nginx:1.27-alpine AS runner
RUN addgroup -S litbuy && adduser -S -G litbuy litbuy
COPY nginx.staging.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
RUN chown -R litbuy:litbuy /var/cache/nginx /var/run /var/log/nginx /usr/share/nginx/html && touch /var/run/nginx.pid && chown litbuy:litbuy /var/run/nginx.pid
USER litbuy
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --retries=5 CMD wget -qO- http://127.0.0.1:3000/healthz >/dev/null || exit 1
CMD ["nginx", "-g", "daemon off;"]
