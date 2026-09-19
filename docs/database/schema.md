# Database Schema

Table-by-table reference for the MySQL 8 schema. `users` through `tickets`
come from `infrastructure/database/schema.sql`; auth-token tables are added by
migrations. How changes reach a running DB is in [`migrations.md`](migrations.md).

## 1. Conventions

| Convention | Rule |
|------------|------|
| Keys | autoincrement `BIGINT id` (except `schema_migrations.name`) |
| Engine | InnoDB, `utf8mb4_unicode_ci`, row-level locking |
| Timestamps | `created_at` default now; `updated_at` on mutable rows |
| Money | `DECIMAL(10,2)` for prices/totals |
| Enums | role/status columns as `ENUM` strings |
| Inventory | `show_seats` appends ledger via `booking_items`; status never edited inline |

## 2. Entity map

```text
users 1---* bookings 1---* booking_items *---1 show_seats
users 1---* refresh_tokens (hashed) + user_action_tokens (hashed, single-use)
venues 1---* seats; events 1---* shows; shows *---* seats via show_seats
bookings 1---* payments + tickets
```

## 3. Tables

| Table | Columns |
|-------|---------|
| `users` | `id` PK, `name`, `email` unique, `phone` unique, `password_hash` (bcrypt), `role`, `status`, `email_verified_at` |
| `venues` | `id` PK, `name`, `address`, `city`, `capacity` |
| `seats` | `id` PK, `venue_id` FK, `row_number`, `seat_number`, `seat_type`; unique `(venue_id,row_number,seat_number)` |
| `events` | `id` PK, `name`, `description`, `category`, `poster_url`, `status` |
| `shows` | `id` PK, `event_id` FK, `venue_id` FK, `start_time`, `end_time`, `status` |
| `show_seats` | `id` PK, `show_id` FK, `seat_id` FK, `price`, `status` (AVAILABLE/HELD/BOOKED/BLOCKED), `hold_token`, `hold_expires_at`, `booking_id`; unique `(show_id,seat_id)` |
| `bookings` | `id` PK, `user_id` FK, `show_id` FK, `booking_reference` unique, `status`, `subtotal/discount/total_amount`, `idempotency_key` |
| `booking_items` | `id` PK, `booking_id` FK, `show_seat_id` FK, `price` |
| `payments` | `id` PK, `booking_id` FK, `provider`, `provider_transaction_id`, `amount`, `status` |
| `tickets` | `id` PK, `booking_id` FK, `ticket_number` unique, `qr_code`, `status` |
| `refresh_tokens` | `id` PK, `user_id` FK, `token_hash` unique (SHA-256), `expires_at`, `revoked_at`, `replaced_by_hash` |
| `user_action_tokens` | `id` PK, `user_id` FK, `purpose` (EMAIL_VERIFICATION/PASSWORD_RESET), `token_hash` unique, `expires_at`, `used_at` |
| `schema_migrations` | `name` PK, `applied_at` |



## 4. Indexes and constraints

`UNIQUE(show_id, seat_id)` prevents duplicate seat rows per show.
`UNIQUE(token_hash)` on token tables prevents hash reuse. Venue->seats uses
`CASCADE`; booking->tickets/payments uses `RESTRICT` for history.

## 5. Caveats

- **No row-level security.** Isolation lives in repositories/services; a query
  forgetting `user_id` scoping would leak. Integration tests cover ownership.
- **`hold_expires_at` is authoritative.** Never trust cached availability for
  the final hold; the atomic guarded `UPDATE` is the contract (ADR 0003).
