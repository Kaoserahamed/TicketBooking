# Testing

How to run the suites, what they cover, and how to read output. Setup is in
[`setup.md`](setup.md); CI jobs in [`../deployment/ci-cd.md`](../deployment/ci-cd.md).

## Backend (`backend/`, node:test)

```bash
cd backend
npm ci
npm run test:unit        # hermetic: no MySQL, no Redis (also in CI)
npm run test:integration # needs MySQL (CI provides the service)
npm test                 # both (CI backend job)
```

- **Isolation:** `tests/unit/` boots Express on an ephemeral port with stubbed
  pool/redis; `tests/integration/` targets `ticket_booking_test` on MySQL 8.
- **Helpers:** unit tests assert envelopes, guards, redaction, and metrics
  without I/O; integration tests exercise auth/booking/events over HTTP.

| File | Covers |
|------|--------|
| `tests/unit/app.test.js` | `/health`, `/metrics`, request-id, helmet, error envelope |
| `tests/unit/config.test.js` | production secret guards, coercion, silent test logs |
| `tests/unit/env-example.test.js` | every `process.env.X` documented in `.env.example` |
| `tests/unit/test-stack.test.js` | `docker-compose.test.yml` + `backend/.env.test.example` stay in sync |
| `tests/unit/error-*.test.js` | envelope shape + Sentry opt-in wiring |
| `tests/unit/logger.test.js` | JSON shape, service/env fields, credential redaction |
| `tests/unit/metrics.test.js` | route-pattern labels, token gate, disabled-mode passthrough |
| `tests/integration/*.test.js` | register/login/refresh, holds, events, venues/shows over MySQL |

Coverage is **enforced** on the frontend; backend unit tests are hermetic so
they run anywhere. SQL checks (`tests/sql/*.sql` via `tests/run-sql-tests.ps1`)
verify seed data, auth queries, the booking flow and the concurrency guards
against a real MySQL, and run as their own CI job.

## Frontend (`frontend/`, Vitest + happy-dom)

```bash
cd frontend
npm ci
npm run test:run         # single run (CI); `npm test` to iterate
npm run test:coverage    # enforced thresholds (CI frontend job)
```

| Area | Covers |
|------|--------|
| `test/api-client.test.ts` | token storage, Bearer attach, single 401 refresh, envelope parsing |
| `test/auth*.test.tsx` | login/register/profile/recovery pages + store |
| `test/bookings*.test.tsx` | hold/cancel/history pages |
| `test/events/shows/venues*.test.tsx` | catalogue browsing + seat maps |
| `test/setup.test.tsx` | Vite proxy + router shell boots |

Coverage enforced in `vite.config.ts` (lines/statements 90, functions/branches
75) over `src/**` excluding `src/test/**`. A new module with no tests pulls the
floor down — that is the point. Type/lint gates run alongside: `npm run lint`,
`npm run typecheck` (`tsc -b`), `npm run format:check`, `npm run build`.

## Interpreting failures

- `401` where `200` expected → stale login helper or missing Bearer; check the
  test token setup.
- `404` on a seeded row → ownership filter (intended — see isolation tests).
- `400 VALIDATION_ERROR` → Zod rejected the payload; `errors[]` names the field.
- `Duplicate entry` in SQL tests → DB already seeded; re-run with `-Fresh`.

