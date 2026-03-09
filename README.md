# Work Vacation Planner

A Next.js app for tracking vacation days and working-day calculations for Swiss workers (Canton Zurich).

## Getting Started

```bash
pnpm install
pnpm run db:migrate   # run migrations (creates dev.db)
pnpm run dev          # start dev server on http://localhost:3000
```

## Tech Stack

- **Next.js 16** (App Router)
- **Drizzle ORM** + **SQLite** via `@libsql/client`
- **Tailwind CSS v4**

## Database

SQLite file at `./dev.db` (path configurable via `DATABASE_PATH` env var).

Migrations live in `drizzle/migrations/`. Run with:

```bash
pnpm run db:migrate
# or directly:
npx tsx scripts/migrate.ts
```

To explore the schema with Drizzle Studio:

```bash
pnpm run db:studio
```

## Environment Variables

| Variable         | Default         | Description                          |
|------------------|-----------------|--------------------------------------|
| `DATABASE_PATH`  | `./dev.db`      | Path to the SQLite database file     |
| `CANTON`         | `ZH`            | Swiss canton for public holiday data |

## ⚠️ Gotchas

### SQLite driver: `@libsql/client` (not `better-sqlite3`)

This project uses [`@libsql/client`](https://github.com/tursodatabase/libsql-client-ts) (Turso's WASM-based SQLite driver) instead of `better-sqlite3`.

**Why?** `better-sqlite3` requires native C++ compilation which fails on macOS arm64 (M1/M2/M3). `@libsql/client` ships pre-compiled WASM binaries and works everywhere without a build step.

**Impact on Drizzle ORM:** `@libsql/client` is async, so all Drizzle queries must be `await`ed. The codebase already handles this.

```ts
// ✅ Correct
const rows = await db.select().from(myTable);

// ❌ Don't do this (was fine with better-sqlite3, breaks with libsql)
const rows = db.select().from(myTable).all();
```

### pnpm install on network-mounted filesystems (e.g. OrbStack)

If `pnpm install` fails with `Worker pnpm#N exited with code 1` or `ETIMEDOUT` on a Mac-mounted volume (OrbStack/Docker), use a locally-installed pnpm:

```bash
npm install -g pnpm --prefix /tmp/pnpm-local
/tmp/pnpm-local/bin/pnpm install --store-dir /tmp/pnpm-store
```

This avoids worker threads trying to load pnpm's runtime files from a slow network mount.

On Alex's machine (macOS arm64), just `pnpm install` works natively.
