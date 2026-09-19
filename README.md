# Ticket Booking System

A scalable ticket booking web application built with **MySQL**, **Node.js + Express.js**, and **React + TypeScript + Vite**.

> **Documentation:** See the [`docs/`](docs/) directory for the full system design documentation.

## Quick Start

### Prerequisites

- Node.js 18+
- MySQL 8+
- Redis
- Docker (optional, for containerized development)

### Development Setup

```bash
# Clone the repository
git clone <repo-url>
cd ticket-booking

# Configure environment (see Environment Variables below)
Copy-Item .env.example .env    # PowerShell
# cp .env.example .env         # bash

# Backend
cd backend
npm install
npm run dev    # starts Express server on http://localhost:4000

# Frontend
cd ../frontend
npm install
npm run dev    # starts Vite dev server on http://localhost:5173

# Start MySQL & Redis with Docker (optional)
docker-compose up -d
```

### Environment Variables

Copy `.env.example` to `.env` and configure:

```env
# Database
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=ticket_booking

# Redis
REDIS_URL=redis://localhost:6379

# Auth
JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_refresh_secret
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Payment
PAYMENT_GATEWAY=stripe
STRIPE_SECRET_KEY=your_stripe_key
STRIPE_WEBHOOK_SECRET=your_webhook_secret

# Email / SMS
SMTP_HOST=smtp.your-provider.com
SMS_PROVIDER=twilio
```

## Backend (Node.js + Express.js)

The API is a modular Express application. Modules are added under
`backend/src/` following the layout in [docs/12-deployment.md](docs/12-deployment.md).

```text
backend/
├── scripts/
│   └── test-connection.js        # standalone MySQL connectivity check
├── src/
│   ├── config/env.js             # env, JWT, security and cookie settings
│   ├── database/pool.js          # mysql2 connection pool + testConnection()
│   ├── repositories/             # data access only (parameterized SQL)
│   │   ├── user.repository.js
│   │   └── refresh-token.repository.js
│   ├── services/                 # business rules (no HTTP, no SQL)
│   │   ├── auth.service.js
│   │   └── user.service.js
│   ├── controllers/              # HTTP translation only
│   │   ├── auth.controller.js
│   │   └── admin.controller.js
│   ├── validators/               # Zod request schemas
│   │   └── auth.validator.js
│   ├── middlewares/
│   │   ├── validate.js           # schema validation
│   │   ├── authenticate.js       # Bearer token -> req.user
│   │   ├── authorize.js          # RBAC guard
│   │   ├── rate-limit.js         # auth rate limiting
│   │   ├── not-found.js
│   │   └── error-handler.js
│   ├── utils/                    # errors, password hashing, JWT, serializers
│   │   ├── logger.js             # pino structured logging (LOG_LEVEL)
│   │   ├── metrics.js            # prom-client registry + /metrics endpoint
│   │   └── error-tracking.js     # optional Sentry wiring (SENTRY_DSN)
│   ├── routes/
│   │   ├── health.routes.js      # /health, /health/db
│   │   ├── auth.routes.js        # /api/v1/auth/*
│   │   └── admin.routes.js       # /api/v1/admin/*
│   ├── app.js                    # Express app factory (testable)
│   └── index.js                  # entry point - boots server, graceful shutdown
├── tests/
│   ├── unit/                     # no external services required
│   └── integration/              # real Express app + real MySQL
├── eslint.config.js              # ESLint 9 flat config
└── tsconfig.json                 # typecheck-only config (`npm run typecheck`)
```

Requests flow in one direction only — each layer has a single responsibility:

```text
route -> validate -> controller -> service -> repository -> MySQL
```

### Scripts

| Command | Description |
|---|---|
| `npm start` | Start the API on `http://localhost:4000` |
| `npm run dev` | Start with auto-reload (`node --watch`) |
| `npm run db:check` | Test the MySQL connection only; exits `1` on failure |
| `npm run lint` | ESLint 9 (flat config) over `src/`, `scripts/` and `tests/` |
| `npm run format:check` | Verify Prettier formatting (`npm run format` fixes it) |
| `npm run typecheck` | `tsc --noEmit` over the JavaScript sources |
| `npm run test:unit` | Unit tests only — no MySQL or Redis required |
| `npm run test:integration` | End-to-end API tests against a real MySQL 8 instance |
| `npm test` | Both suites (`tests/unit` + `tests/integration`) |
| `npm run test:coverage` | Unit tests with the enforced coverage floors (`scripts/check-coverage.js`) |
| `npm run verify` | Lint + format + typecheck + unit tests — run before pushing |

### Quality gates

The same gates run in CI on every push and pull request
([`.github/workflows/ci.yml`](.github/workflows/ci.yml)):

| Gate | Backend | Frontend |
|---|---|---|
| Lint | `npm run lint` | `npm run lint` |
| Formatting | `npm run format:check` | `npm run format:check` |
| Typecheck | `npm run typecheck` | `npm run typecheck` |
| Dependency audit | `npm audit --audit-level=high` | `npm audit --audit-level=high` |
| Tests | `npm test` vs a real MySQL 8 service | `npm run test:coverage` |
| Coverage floor | unit suite: 55% lines, 80% branches, 30% functions ([`scripts/check-coverage.js`](backend/scripts/check-coverage.js)) | 90% lines/statements, 75% functions/branches |

The frontend coverage floors are enforced by `vitest` thresholds in
[`frontend/vite.config.ts`](frontend/vite.config.ts): a run that drops below any
of them fails the job. Dependency updates are proposed weekly by
[`.github/dependabot.yml`](.github/dependabot.yml).

Two further jobs guard the parts that are neither half:

| Job | Runs | Fails when |
|---|---|---|
| Database — SQL suite | [`tests/run-sql-tests.ps1`](tests/run-sql-tests.ps1) `-Fresh` against a `mysql:8.0` service | any `ERROR <code>` in a `tests/sql/` script |
| Infrastructure — manifest validation | `kubectl kustomize` then `kubeconform -strict` (Kubernetes 1.29 schemas) | a rendered object fails schema validation |

Both are prerequisites for the container job, so a broken schema or manifest
cannot publish an image.

### Run the tests locally

The unit suites are hermetic — they need nothing but Node. The integration
suites are end-to-end and need a real MySQL 8 (the API also uses Redis for
shared rate limiting). To get both without a pre-existing database account,
use the throwaway stack in
[`docker-compose.test.yml`](docker-compose.test.yml):

```bash
# 1. Start throwaway MySQL (host port 3307) + Redis (host port 6380)
docker compose -f docker-compose.test.yml up -d

# 2. Point the backend at that stack - backend/.env wins over the root .env
Copy-Item backend/.env.test.example backend/.env   # PowerShell
# cp backend/.env.test.example backend/.env        # bash

# 3. Run everything
cd backend && npm ci && npm test

# 4. Tear down (no volumes, so this always leaves a clean slate)
docker compose -f docker-compose.test.yml down -v
```

The non-default ports let the test stack coexist with a development stack
already bound to `3306`/`6379`; override with `MYSQL_TEST_PORT` /
`REDIS_TEST_PORT` if those collide too. `backend/.env` is git-ignored.

Shortest path when you only want the fast, hermetic suite:

```bash
cd backend && npm run test:unit      # no MySQL or Redis required
cd frontend && npm run test:coverage # coverage floors enforced
```

### Verifying the connections

```bash
cd backend
npm run db:check     # database connection
npm test             # server + database endpoints
```

| Endpoint | Purpose | Success |
|---|---|---|
| `GET /` | API metadata | `200` |
| `GET /health` | **Server** liveness (no DB access) | `200` |
| `GET /health/db` | **Database** readiness (`SELECT DATABASE(), VERSION()`) | `200`, or `503` when MySQL is unreachable |

Example response from `GET /health/db`:

```json
{
  "status": "ok",
  "database": {
    "connected": true,
    "host": "127.0.0.1",
    "port": 3306,
    "database": "ticket_booking",
    "version": "26.7.0",
    "tables": 11,
    "checkedAt": "2026-09-18T14:48:34.686Z"
  }
}
```

## Authentication & Authorization

Implements [docs/04-api-design.md](docs/04-api-design.md) §4.2 and
[docs/11-security.md](docs/11-security.md) §11.1–11.2.

### Endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/v1/auth/register` | — | Create an account (always role `USER`) and sign in |
| `POST` | `/api/v1/auth/login` | — | Exchange email + password for a token pair |
| `POST` | `/api/v1/auth/refresh` | refresh token | Rotate the refresh token and get a new access token |
| `POST` | `/api/v1/auth/logout` | refresh token | Revoke the refresh token (idempotent) |
| `GET` | `/api/v1/auth/me` | Bearer access token | Current user's profile |
| `GET` | `/api/v1/admin/users` | Bearer + `ADMIN` role | List users (`?role=`, `?status=`, `?limit=`) |

### Security controls

| Control | Implementation |
|---|---|
| Password storage | bcrypt hashing (`bcryptjs`), cost 10 — `utils/password.js` |
| Access token | JWT, 15 min, carries `sub`/`role`/`type=access` |
| Refresh token | JWT, 7 days, carries a unique `jti`; **only its SHA-256 hash is stored** |
| Refresh-token rotation | Every refresh revokes the old row and records `replaced_by_hash` |
| Reuse detection | Replaying a rotated token revokes **all** of that user's sessions |
| Token transport | Access token in memory; refresh token also set as an `httpOnly` + `SameSite` cookie scoped to `/api/v1/auth` |
| Input validation | Zod schemas at the edge; unknown fields (e.g. `role`) are stripped |
| SQL injection | `pool.execute` prepared statements with bound parameters everywhere |
| RBAC | `authorize('ADMIN')` middleware, enforced server-side |
| Account status | `SUSPENDED`/`BLOCKED`/`INACTIVE` accounts cannot sign in (`403`) |
| Enumeration resistance | Wrong password and unknown email return an identical `401` |
| Rate limiting | 20 requests / 15 min per IP on credential endpoints |

### Example

```bash
# Register
curl -X POST http://localhost:4000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice","email":"alice@example.com","password":"Secret123"}'

# Login -> { "tokens": { "accessToken": "...", "refreshToken": "..." } }
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"Secret123"}'

# Authenticated call
curl http://localhost:4000/api/v1/auth/me -H "Authorization: Bearer <accessToken>"

# Rotate
curl -X POST http://localhost:4000/api/v1/auth/refresh \
  -H "Content-Type: application/json" -d '{"refreshToken":"<refreshToken>"}'
```

Error responses are uniform:

```json
{
  "status": "error",
  "message": "Invalid request body",
  "code": "VALIDATION_ERROR",
  "errors": [{ "field": "password", "message": "Password must be at least 8 characters" }]
}
```

> **Database note:** refresh tokens live in the `refresh_tokens` table. An
> existing database can be upgraded without a destructive reset:
> `mysql ticket_booking < infrastructure/database/migrations/001-refresh-tokens.sql`
> (or recreate everything with `.\tests\run-sql-tests.ps1 -Fresh`).

> **Scaling note:** the rate limiter uses an in-process store, so its budget is
> per API instance. Behind a load balancer this must move to a shared Redis store
> ([docs/08-infrastructure-caching.md](docs/08-infrastructure-caching.md)).

## Database Tests

The SQL test/verification scripts in [`tests/sql`](tests/sql/) cover user auth, events,
venues/seats, shows, availability, the booking flow, payments, tickets, admin reports,
concurrency (double-booking prevention) and background workers.

```powershell
# Run every test script against the database configured in .env
.\tests\run-sql-tests.ps1

# Recreate the database from infrastructure/database/schema.sql first
# (needed when the seed data already exists — makes the suite repeatable)
.\tests\run-sql-tests.ps1 -Fresh

# Run against another database
.\tests\run-sql-tests.ps1 -Fresh -Database ticket_booking_test
```

With `-Fresh` the runner recreates the database from
[`infrastructure/database/schema.sql`](infrastructure/database/schema.sql), then runs
each file in `tests/sql/` in order. A file FAILS when MySQL reports any error, and the
script exits with code 0 only when all files pass.

## Frontend (React + TypeScript + Vite)

The SPA lives in `frontend/src` and talks to the API through a typed axios layer
(`src/api/client.ts` and one module per resource) backed by Zustand stores. The
client attaches the access token, retries once through `/auth/refresh` on a
`401`, and drops the session when the refresh fails.

### Scripts

| Command | Description |
|---|---|
| `npm run dev` | Vite dev server on `http://localhost:5173` (proxies `/api` to `:4000`) |
| `npm run build` | Typecheck (`tsc -b`) then produce the production bundle |
| `npm run preview` | Serve the built bundle locally |
| `npm run lint` | ESLint 9 flat config + react-hooks / react-refresh rules |
| `npm run format:check` | Verify Prettier formatting (`npm run format` fixes it) |
| `npm run typecheck` | `tsc -b` with `strict` and `noUncheckedIndexedAccess` |
| `npm run test` | Vitest in watch mode |
| `npm run test:run` | Vitest single run (CI-style) |
| `npm run test:coverage` | Single run with the enforced coverage floors |
| `npm run verify` | Lint + format + typecheck + coverage — run before pushing |

Tests live in [`frontend/src/test/`](frontend/src/test/) (Testing Library on
`happy-dom`) and cover the pages, the API layer and the auth store.

## Documentation

| # | Document | Topic |
|---|----------|-------|
| 01 | [Overview](docs/01-overview.md) | Project overview, objectives, NFRs, assumptions |
| 02 | [System Architecture](docs/02-system-architecture.md) | High-level arch, components, CDN/WAF, LB, backend |
| 03 | [Database Design](docs/03-database-design.md) | Schema, tables, relationships (MySQL) |
| 04 | [API Design](docs/04-api-design.md) | REST endpoints and design conventions |
| 05 | [Booking Domain](docs/05-domain-booking.md) | Double-booking prevention, seat locking, flow, state machine |
| 06 | [Payment Domain](docs/06-domain-payment.md) | Payment architecture, webhooks, idempotency |
| 07 | [Tickets Domain](docs/07-domain-tickets.md) | Ticket generation, QR validation |
| 08 | [Caching](docs/08-infrastructure-caching.md) | Redis usage and caching strategy |
| 09 | [Search](docs/09-infrastructure-search.md) | Search architecture and indexing |
| 10 | [Notifications](docs/10-infrastructure-notifications.md) | Message queue and notification service |
| 11 | [Security](docs/11-security.md) | Auth, authorization, security controls, rate limiting |
| 12 | [Deployment](docs/12-deployment.md) | Deployment, CI/CD, environments, repo structure |
| 13 | [Scaling](docs/13-scaling.md) | Hot events, waiting room, capacity, load testing, evolution |
| 14 | [Operations](docs/14-operations.md) | Failure scenarios and consistency model |

Start with the [Documentation README](docs/README.md) for an introduction.

---

## Architecture Summary

The system is designed for **100,000+ registered users** with **10,000+ peak concurrent users**. The primary architectural challenge is **preventing double booking** while maintaining high availability during traffic spikes.

Key design decisions:
- **Atomic seat reservation** using MySQL transactions with row-level locking
- **Temporary seat holds** (5–10 min) with background cleanup workers
- **Payment verification via secure webhooks** (never trust the frontend)
- **Idempotent booking & payment APIs**
- **Redis caching** for read-heavy operations (DB is source of truth)
- **Horizontal API scaling** with stateless Express servers

See [docs/README.md](docs/README.md) for the full documentation index.