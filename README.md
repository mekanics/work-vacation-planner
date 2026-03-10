# Work & Vacation Planner

[![Quality](https://github.com/mekanics/work-vacation-planner/actions/workflows/quality.yml/badge.svg)](https://github.com/mekanics/work-vacation-planner/actions/workflows/quality.yml)

A self-hosted work calendar for tracking working days, vacation, and public holidays — built for Switzerland.

---

## Features

- **Year & month views** — working days, vacation, public holidays at a glance
- **Canton-aware Swiss holidays** — all 26 cantons + national only, sourced from [openholidays.org](https://openholidaysapi.org)
- **Vacation tracking** — click days to mark vacation; annual budget tracker shows days used vs. target
- **Projects** — colour-coded projects scoped to weekdays/date ranges; tracks working days, days remaining, next working day
- **Non-working weekdays** — configure recurring non-working days (e.g. "I never work Fridays")
- **Working weekends** — mark exception days where you work on a Saturday or Sunday
- **CSV export** — full year export with day type, holidays, and projects
- **Self-hosted** — SQLite, single Docker container, no accounts, no SaaS

---

## Quick Start (Docker)

```bash
docker compose up
```

Open [http://localhost:3000](http://localhost:3000). Select your canton in settings (⚙️) — holidays load automatically.

---

## Development

```bash
npm install
npm run db:migrate   # creates dev.db and runs migrations
npm run dev          # http://localhost:3000
```

Run tests:

```bash
npm test             # vitest run
npm run lint         # eslint
npx tsc --noEmit     # typecheck
```

---

## Environment Variables

| Variable        | Default      | Description                      |
|-----------------|--------------|----------------------------------|
| `DATABASE_PATH` | `./dev.db`   | Path to the SQLite database file |

Canton is configured in the app settings UI, not via environment variable.

---

## Tech Stack

- **Next.js 16** (App Router, server + client components)
- **Drizzle ORM** + **LibSQL** (SQLite via `@libsql/client`)
- **Tailwind CSS v4**
- **Vitest** for unit tests

---

## Releasing

```bash
npm version patch   # or minor / major — bumps package.json + creates git tag
git push && git push --tags
```

CI builds the Docker image and pushes to `ghcr.io/mekanics/work-vacation-planner:{version}` + `:latest`.
