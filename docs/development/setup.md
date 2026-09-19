# Development Setup

Everything needed to run TicketBooking on a developer machine. Checks a change
must pass: [`testing.md`](testing.md). Branching rules:
[`git-workflow.md`](git-workflow.md).

## 1. Prerequisites

| Tool | Version | Needed for |
|------|---------|------------|
| Node.js | 20+ | API, SPA, vitest |
| npm | bundled | installs |
| MySQL | 8+ (or Docker) | runtime + integration tests |
| Docker | any recent | MySQL container, image builds |
| Redis | optional | shared rate limiting / cache |

## 2. Install

```bash
git clone <repo-url> TicketBookingSystem
cd TicketBookingSystem
cd backend && npm ci
cd ../frontend && npm ci
```

## 3. Configure

| File | Template | Required values |
|------|----------|-----------------|
| `.env` (root) | `.env.example` | `DB_PASSWORD`, `JWT_SECRET`, `JWT_REFRESH_SECRET` |
| `backend/.env` | root `.env.example` | overrides for API only (optional) |

```bash
Copy-Item .env.example .env   # PowerShell
# cp .env.example .env        # bash
```

Generate real secrets locally; never commit `.env`. `NODE_ENV=production`
makes `src/config/env.js` refuse placeholder JWT secrets at startup. Full key
list: [`../security/secrets-management.md`](../security/secrets-management.md).

## 4. Run

```bash
# Terminal 1 - database (skip if MySQL already runs on :3306)
docker compose up -d mysql
cd backend && npm run db:migrate

# Terminal 2 - API
cd backend && npm run dev            # http://localhost:4000 (/health)

# Terminal 3 - web
cd frontend && npm run dev           # http://localhost:5173
```

Or the whole stack: `docker compose up --build` (web `:8080`, api `:4000`).

## 5. Everyday commands

| Command | What it does |
|---------|--------------|
| `npm run verify` (per stack) | lint + format + typecheck + tests |
| `npm run test:unit` (backend) | hermetic unit suite, no DB |
| `npm run test:coverage` (frontend) | vitest with enforced thresholds |
| `npm run build` (frontend) | `tsc -b && vite build` |
| `.\tests\run-sql-tests.ps1 -Fresh` | rebuild DB from schema.sql, run SQL checks |

## 6. Troubleshooting

| Symptom | Fix |
|---------|-----|
| `JWT_SECRET must be set` | `.env` missing — copy from `.env.example` |
| `database connection failed` | MySQL not up: `docker compose up -d mysql`, retry `npm run db:migrate` |
| SPA calls `:4000` directly | expected in dev (vite proxy); in prod nginx proxies `/api` same-origin |
| `401` on every request | expired access token + missing refresh — clear `localStorage`, log in again |
| `Duplicate entry` in SQL tests | DB already seeded — re-run with `-Fresh` |

