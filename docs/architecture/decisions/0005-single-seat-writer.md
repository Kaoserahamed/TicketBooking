# ADR 0005 — All seat mutations go through one writer

- **Date:** 2026-09-19
- **Status:** Accepted

## Context

Seat state is touched by holds, cancellations, expiries, and admin blocks.
Letting each controller update `show_seats.status` inline previously risked
drift between the seat row and the booking ledger.

## Decision

`services/booking.service.js` plus `repositories/show-seat.repository.js` is
the **single writer** for `show_seats.status`. It validates (seat list
non-empty, idempotency key carried, transaction open), applies the atomic
guarded update, and inserts the `booking_items` rows in the same transaction.
All routes — including cancel and expiry — call it; nothing else assigns the
status column.

## Consequences

- The ledger always reconciles: `sum(booking_items)` matches held/booked rows.
- The oversell guard lives in one place with one error path that hold
  surfaces as `409 SEATS_UNAVAILABLE`.
- Future concurrency control (partitioned retries, queue) has a single
  function to harden.
