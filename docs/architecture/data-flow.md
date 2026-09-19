# Data Flow

How a request travels through TicketBooking and which process owns each write.
Layer responsibilities live in
[`system-architecture.md`](system-architecture.md); the tables in
[`../database/schema.md`](../database/schema.md).

## 1. Request lifecycle

```text
Browser (React SPA)
  | axios instance in frontend/src/api/client.ts
  | Authorization: Bearer <access> (+ httpOnly refresh cookie)
  v
helmet -> cors -> json(1mb) -> cookieParser -> httpLogger -> metrics
  v
Express route (backend/src/routes/*.js)
  -> Zod validation (backend/src/validators/*.js)
  -> authenticate (Bearer -> req.user) -> authorize (role)
  -> one controller call -> one service call
  -> pool.execute(...) commit
  v
{ status: ok, ... } or { status: error, code, message }
```

## 2. Seat write path (the most important invariant)

`show_seats.status` and its `booking_items` rows are written **together, in one
transaction**, by the feature that caused the movement:

| Trigger        | Endpoint                           | Seat transition        | Ledger write                 |
| -------------- | ---------------------------------- | ---------------------- | ---------------------------- |
| Hold created   | `POST /api/v1/bookings/hold`       | `AVAILABLE -> HELD`    | `bookings` + `booking_items` |
| Hold cancelled | `POST /api/v1/bookings/:id/cancel` | `HELD -> AVAILABLE`    | booking -> `CANCELLED`       |
| Hold expired   | worker sweep                       | `HELD -> AVAILABLE`    | booking -> `EXPIRED`         |
| Admin block    | `POST /api/v1/admin/...`           | `AVAILABLE -> BLOCKED` | none (ops action)            |

`services/booking.service.js` is the **guarded** writer: it requires seat ids,
carries the `Idempotency-Key`, and refuses oversell (`409 SEATS_UNAVAILABLE`).
The trading paths apply the guarded `UPDATE ... WHERE status='AVAILABLE'`
inline and insert the same ledger rows in the same commit.

## 3. Other write paths

| Domain    | Endpoint                                               | Writes                                                            |
| --------- | ------------------------------------------------------ | ----------------------------------------------------------------- |
| Catalogue | `POST/PATCH /api/v1/admin/events`, `/venues`, `/shows` | Row; seat layout derived per show                                 |
| Identity  | `POST /api/v1/auth/*`, `/api/v1/users/me`              | `users`, hashed `refresh_tokens`, single-use `user_action_tokens` |
| Platform  | `npm run db:migrate`                                   | `schema_migrations` row per file                                  |

## 4. Read paths

- **Events/venues/shows** are plain SELECTs with `limit/offset` filters; they
  may be cached, but the hold path never trusts the cache.
- **Availability** counts `show_seats` by status per show; the final hold still
  re-checks atomically in the transaction.
- **List endpoints batch** their joins so a page costs a fixed handful of
  queries instead of N+1.

## 5. Frontend data flow

```text
pages/ (route page)
  -> api/<domain>.ts (one typed module per domain - the only fetch layer)
  -> api/client.ts (axios, bearer token, 401 refresh, envelope -> message)
  -> backend
```

`stores/auth.ts` owns token storage; `api/` is the single place a backend
contract change has to be mirrored, which is why
`frontend/src/test/api-client.test.ts` asserts the refresh behaviour.
