# ADR 0001 — Backend + frontend in one monorepo

- **Date:** 2026-09-19
- **Status:** Accepted

## Context

TicketBooking ships an Express API and a React/Vite UI that evolve together:
every backend phase (events, venues, shows, booking, tickets) has a matching
frontend surface. Two repositories would force lock-step PRs and version skew
between the API contract and its only consumer.

## Decision

Keep `backend/` and `frontend/` in a single repository with one CI pipeline,
one issue tracker, and one release tag covering both halves.
Shared runtime config (`docker-compose.yml`, `.env.example`, `docs/`) stays at
the root so `docker compose up` starts a known-good pair.

## Consequences

- One `git clone` gives a contributor everything; per-stack `npm ci` sets up both.
- CI can gate a backend contract change on the frontend build in the same run.
- Release tags (`v0.1.0`) always describe a known-good backend+frontend pair.
- The tradeoff (larger checkout, mixed toolchains) is handled with per-stack
  ignore rules, lockfiles, and working-directory-scoped CI jobs.
