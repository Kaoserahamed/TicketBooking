# System Architecture

How TicketBooking is put together, where code lives, and which rules keep the
layers honest.

| Related document                                       | What it covers                         |
| ------------------------------------------------------ | -------------------------------------- |
| [`data-flow.md`](data-flow.md)                         | Request lifecycle and write/read paths |
| [`decisions/`](decisions/)                             | ADRs (why, not what)                   |
| [`../database/schema.md`](../database/schema.md)       | Table-by-table model                   |
| [`../api/authentication.md`](../api/authentication.md) | Token model, RBAC, errors              |
| [`../../01-overview.md`](../../01-overview.md)         | Objectives and NFRs                    |

## System overview

```text
React + Vite SPA (:5173)
  | HTTPS/JSON (axios, Bearer + httpOnly refresh cookie)
  v
Express API (:4000): routes -> validate -> controllers -> services -> repos
  | mysql2 pool
  v
MySQL 8 (InnoDB) + optional Redis
```

- **Monorepo** ([ADR 0001](decisions/0001-monorepo-layout.md)): `backend/` +
  `frontend/` versioned and released together.
- **Database:** MySQL 8 everywhere; unit suite needs no DB
  ([ADR 0002](decisions/0002-mysql-primary-hermetic-unit-tests.md)).
- **Auth:** access + rotating refresh tokens
  ([ADR 0004](decisions/0004-jwt-access-refresh.md)).

## Backend layering (`backend/src/`)

| Layer         | Directory                                     | May import                   | Must NOT import            |
| ------------- | --------------------------------------------- | ---------------------------- | -------------------------- |
| HTTP          | `routes/`, `app.js`                           | `middlewares`, `controllers` | business rules             |
| Translation   | `controllers/`                                | `services`, `utils/errors`   | `database`, SQL            |
| Business      | `services/`                                   | `repositories`, `utils`      | `controllers`, `routes`    |
| Validation    | `validators/` (Zod)                           | `validators/fields`          | `services`, `repositories` |
| Persistence   | `repositories/`                               | `database/pool`              | `services`, `controllers`  |
| Cross-cutting | `config/`, `middlewares/`, `utils/`, `cache/` | stdlib + libs                | business rules             |

1. Routes are **thin**: middleware + validation + one controller call.
2. Controllers translate HTTP only and use the `{status, code, message}`
   envelope.
3. Seat writes go through `booking.service.js` + `show-seat.repository.js`.

## Frontend layering (`frontend/src/`)

| Layer      | Directory                         | Responsibility                                          |
| ---------- | --------------------------------- | ------------------------------------------------------- |
| Routes     | `pages/`                          | Composition: fetch via `api/`, render via `components/` |
| Components | `components/`                     | Presentational UI                                       |
| State      | `stores/auth.ts`, `api/client.ts` | Session + axios interceptors                            |
| Services   | `api/`                            | Typed per-domain modules, the only fetch layer          |

## Observability

- `utils/logger.js` (pino JSON, redacted secrets) + `middlewares/http-logger.js`
  (`x-request-id`, probes excluded).
- `utils/metrics.js` (`http_requests_total`, duration histogram) at
  `GET /metrics` (optional `METRICS_TOKEN`).
- `utils/error-tracking.js` (Sentry opt-in) + `middlewares/error-handler.js`
  (uniform envelope). Health: `/health`, `/health/db`.
