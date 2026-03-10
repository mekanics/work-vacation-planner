FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

# Dependencies
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Builder
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# Runner
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV DATABASE_PATH=/data/planner.db

RUN addgroup -S -g 1000 appgroup && adduser -S -u 1000 appuser -G appgroup

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/scripts ./scripts
COPY entrypoint.sh ./entrypoint.sh

# drizzle-orm is pure JS so Next.js bundles it inline — it won't be in
# standalone/node_modules. Copy it explicitly so migrate.ts can import it.
COPY --from=deps /app/node_modules/drizzle-orm ./node_modules/drizzle-orm

RUN mkdir -p /data && chown -R appuser:appgroup /data /app
RUN chmod +x entrypoint.sh

USER appuser

EXPOSE 3000
ENTRYPOINT ["./entrypoint.sh"]
