# ADR 0002 — MySQL in production, hermetic unit tests with no database

- **Date:** 2026-09-19
- **Status:** Accepted

## Context

The suite must be verifiable on a fresh clone, yet production needs a real
multi-user RDBMS with row-level locking for concurrent seat holds. Ticket
inventory is finite and must never be oversold, so the runtime database cannot
be a toy.

## Decision

- **Production / local runtime:** MySQL 8 (InnoDB), migrated with
  `backend/scripts/run-migrations.js` over
  `infrastructure/database/migrations/`.
- **Tests:** `backend/tests/unit/` runs with **no database at all** (pure
  Express + `node:test`, stubbed pool). `backend/tests/integration/` targets a
  real MySQL service (CI provides it).
- SQL stays portable MySQL 8: no engine-specific tricks in repositories;
  anything clever lives in one guarded statement, not in application code.

## Consequences

- `npm run test:unit` works with zero setup; CI needs MySQL only for the
  integration job.
- Repository SQL avoids MySQL-only constructs outside migrations.
- The atomic `UPDATE ... WHERE status='AVAILABLE'` plus `SELECT ... FOR UPDATE`
  paths are the concurrency contract (see 05-domain-booking.md).
