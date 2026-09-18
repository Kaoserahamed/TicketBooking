# 5. Booking Domain

## 5.1 The Double-Booking Problem

The most critical operational problem in a ticket booking system is **double booking** — selling the same seat to multiple users simultaneously.

Consider:

```text
Seat A1
```

Two users simultaneously click it:

```text
User A ─────┐
            ├──► Seat A1
User B ─────┘
```

Without concurrency control:

```text
User A → AVAILABLE → BOOK
User B → AVAILABLE → BOOK
```

**Result: DOUBLE BOOKING** — this must never happen.

## 5.2 Seat Locking Strategy

The recommended approach uses a temporary **HOLD** state:

```text
AVAILABLE
    │
    ▼
HELD
    │
    ├── Payment Success ──► BOOKED
    │
    └── Timeout ─────────► AVAILABLE
```

**Example:**

```text
Seat: A1

Status: HELD
Hold Token: abc123
Expires: 18:57:00
```

The user receives approximately 5–10 minutes to complete payment.

## 5.3 Atomic Seat Reservation

The reservation must be **atomic** — a single operation that checks availability and reserves in one step.

### Conceptually (MySQL):

```sql
UPDATE show_seats
SET
    status = 'HELD',
    hold_token = :token,
    hold_expires_at = :expiry
WHERE
    id = :seat_id
    AND status = 'AVAILABLE';
```

### Check Result

```text
Rows affected = 1
    → Successfully held

Rows affected = 0
    → Seat unavailable
```

For multiple seats, perform the operation inside a single **database transaction** so that either all seats are held or none are.

## 5.4 Alternative: Row-Level Lock

MySQL (InnoDB) supports `SELECT ... FOR UPDATE`:

```sql
BEGIN;

SELECT *
FROM show_seats
WHERE show_id = :show_id
  AND seat_id IN (...)
FOR UPDATE;

-- Check availability
-- Change AVAILABLE → HELD
-- Create booking

COMMIT;
```

This prevents concurrent transactions from modifying the same rows incorrectly. Either the atomic `UPDATE` approach or the row-lock approach can be used; the atomic approach generally offers better performance for high-contention scenarios.

## 5.5 Redis Usage

Redis should **not replace the primary database** as the authoritative ticket inventory.

Redis can be used for:

- Event caching
- Seat availability cache
- Session data
- Rate limiting
- Distributed locks where appropriate
- Temporary hold metadata
- Frequently accessed event information

**Example Redis keys:**

```text
Redis

event:123
event:123:shows
show:456:availability
rate:user:789
```

The database remains the **source of truth** for confirmed inventory.

## 5.6 Seat Hold Expiration

```text
User selects A1

18:50
↓
A1 = HELD

Expiry:
18:55
```

A background worker periodically finds expired holds and releases them:

```text
HELD
  │
  │ expiry reached
  ▼
AVAILABLE
```

**Possible implementations:**

- Scheduled worker (database query: `UPDATE ... WHERE hold_expires_at < NOW() AND status = 'HELD'`)
- Redis delayed queue
- RabbitMQ delayed message
- Database polling

For a 100K-user application, a **worker-based approach** is sufficient.

## 5.7 Booking Flow

```text
User
 │
 │ Select seats
 ▼
Frontend
 │
 │ POST /bookings/hold
 ▼
API
 │
 ▼
Database Transaction
 │
 ├── Check availability
 │
 ├── Lock seats
 │
 ├── Create HOLD
 │
 └── Create booking
 │
 ▼
Payment Page (frontend redirects to payment gateway)
 │
 ▼
Payment Gateway
 │
 ▼
Webhook (POST /payments/webhook)
 │
 ▼
Payment Service
 │
 ▼
Database Transaction
 │
 ├── Verify payment
 ├── HELD → BOOKED
 └── Generate ticket
 │
 ▼
Notification Queue
 │
 ├── Email
 ├── SMS
 └── Push
```

## 5.8 Booking State Machine

```text
              ┌─────────────┐
              │   PENDING   │
              └──────┬──────┘
                     │
                     ▼
           ┌──────────────────┐
           │ PAYMENT_PROCESSING│
           └────────┬─────────┘
                    │
              ┌─────┴─────┐
              ▼           ▼
         ┌──────────┐  ┌────────┐
         │ CONFIRMED│  │ FAILED │
         └────┬─────┘  └────────┘
              │
              ▼
          ┌──────────┐
          │ CANCELLED│
          └────┬─────┘
               │
               ▼
           REFUNDED
```
