# ADR 0003 — Atomic seat hold first, worker expiry second

- **Date:** 2026-09-19
- **Status:** Accepted

## Context

Seat holds (05-domain-booking.md) must be testable in CI without timers,
workers, or Redis, while still expiring reliably in production when a buyer
abandons checkout.

## Decision

Every hold computes a **deterministic expiry timestamp in SQL first**
(`NOW() + INTERVAL`), guarded by the atomic availability update.
Expiry itself is a separate idempotent sweep
(`UPDATE ... WHERE hold_expires_at < NOW() AND status='HELD'`), runnable from
any worker, cron, or manual query.

## Consequences

- Tests assert on real state transitions (AVAILABLE -> HELD -> BOOKED) with no
  mocks and no sleeps.
- No timer path can change figures: the sweeper only releases expired holds.
- Operators get graceful degradation: holds work on day one, expiry improves
  when a worker is scheduled.
