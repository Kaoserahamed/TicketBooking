# Authentication & API Access

- **Base URL:** `https://<your-domain>/api/v1` (local: `http://localhost:4000/api/v1`)
- **Protocol:** HTTPS only outside local development
- **Format:** JSON, `Content-Type: application/json`
- **Design source:** [`../../04-api-design.md`](../../04-api-design.md)

## 1. Required headers

| Header            | When                                                                     | Value                                       |
| ----------------- | ------------------------------------------------------------------------ | ------------------------------------------- |
| `Authorization`   | every endpoint except register/login/refresh/forgot/reset and `/health*` | `Bearer <access_token>`                     |
| `X-Request-Id`    | optional                                                                 | echoed back for log correlation             |
| `Idempotency-Key` | `POST /api/v1/bookings/hold`                                             | client key; replay returns the same booking |

## 2. Token model

| Token   | Lifetime                          | Used at                      |
| ------- | --------------------------------- | ---------------------------- |
| Access  | 15 min (`JWT_ACCESS_EXPIRES_IN`)  | every authenticated endpoint |
| Refresh | 7 days (`JWT_REFRESH_EXPIRES_IN`) | `POST /auth/refresh` only    |

JWTs signed with `JWT_SECRET` / `JWT_REFRESH_SECRET`. Only the SHA-256 hash of
a refresh token is stored (`refresh_tokens.token_hash`); rotation revokes the
old row. See [ADR 0004](../architecture/decisions/0004-jwt-access-refresh.md).

## 3. Flows

```http
POST /api/v1/auth/register
{"name","email","password"} -> 201 {status:ok, user, tokens}
POST /api/v1/auth/login
{"email","password"} -> 200 {status:ok, tokens:{accessToken, refreshToken}}
POST /api/v1/auth/refresh
{"refreshToken"} -> 200 {status:ok, tokens:{...}} (old row revoked)
POST /api/v1/auth/logout
{"refreshToken"} -> 200 (row revoked; access token expires naturally)
```

`username` accepts email or phone. Wrong password, inactive user, or unknown
account all return the same `401 INVALID_CREDENTIALS` (no enumeration).
Recovery (`forgot-password` / `reset-password`) always returns the same
response whether the account exists.

How a client authenticates, which role may call what, and the error contract.

## 4. Roles

| Role          | Can                                                  |
| ------------- | ---------------------------------------------------- |
| USER          | browse events/venues/shows, hold/cancel own bookings |
| EVENT_MANAGER | USER + manage events/shows                           |
| VENUE_MANAGER | USER + manage venues/seats                           |
| ADMIN         | everything, incl. `GET /api/v1/admin/users`          |
| SUPPORT       | read-only help flows                                 |

Enforced in `middlewares/authorize.js`; the SPA role guard is UX only.

## 5. Error contract

Every failure is `{status:"error", code, message}` plus `errors[]` for Zod
validation. Codes: `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`,
`NOT_FOUND`, `SEATS_UNAVAILABLE`, `TOO_MANY_REQUESTS`, `INVALID_JSON`.

## 6. Endpoint catalogue

Authoritative list: [`../../04-api-design.md`](../../04-api-design.md) plus
`GET /` on the running API. Groups: auth, users, events, venues, shows,
bookings, admin, probes (`/health`, `/health/db`), metrics.
