# syntax=docker/dockerfile:1

# base and build stages run on the BUILD platform (native amd64 on CI)
# so pnpm install and Next.js compilation never run under QEMU emulation.
# Only the runner stage targets the final platform (arm64 or amd64).
FROM --platform=$BUILDPLATFORM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

# Dependencies
FROM --platform=$BUILDPLATFORM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Builder
FROM --platform=$BUILDPLATFORM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# Runner — targets the final platform; node_modules (incl. all native binaries) copied from deps
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV DATABASE_PATH=/data/planner.db

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/scripts ./scripts
COPY entrypoint.sh ./entrypoint.sh

# drizzle-orm is pure JS so Next.js bundles it inline — it won't be in
# standalone/node_modules. Copy it explicitly so migrate.ts can import it.
COPY --from=deps /app/node_modules/drizzle-orm ./node_modules/drizzle-orm

# libsql client and its native binaries (installed for all arches via pnpm supportedArchitectures)
COPY --from=deps /app/node_modules/@libsql ./node_modules/@libsql

# node:22-alpine already ships with user 'node' at UID/GID 1000 — use it directly
RUN mkdir -p /data && chown -R node:node /data /app
RUN chmod +x entrypoint.sh

USER node

EXPOSE 3000
ENTRYPOINT ["./entrypoint.sh"]
