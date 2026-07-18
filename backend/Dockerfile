FROM oven/bun:1.2.23 AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM oven/bun:1.2.23 AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run prisma:generate
RUN bun run build
RUN bun run check:prod-entrypoint

FROM node:22.11.0-slim AS runner
RUN useradd --system --uid 10001 litbuy
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/prisma ./prisma
USER litbuy
EXPOSE 3001
CMD ["node", "dist/main.js"]
