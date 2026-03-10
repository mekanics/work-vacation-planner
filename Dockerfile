FROM node:22-alpine AS base

# Dependencies
FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Builder
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Runner
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV DATABASE_PATH=/data/planner.db

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/scripts ./scripts
COPY entrypoint.sh ./entrypoint.sh

RUN mkdir -p /data && chown -R appuser:appgroup /data /app
RUN chmod +x entrypoint.sh

USER appuser

EXPOSE 3000
ENTRYPOINT ["./entrypoint.sh"]
