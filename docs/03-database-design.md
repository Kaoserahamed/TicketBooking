# 3. Database Design

## 3.1 Overview

**MySQL** is the primary database. Ticket booking requires strong transactional guarantees, which MySQL (with its InnoDB engine and row-level locking support) provides.

This document covers the core schema tables and their relationships.

## 3.2 Users

```text
users
-------------------------
id              PK
name
email           UNIQUE
phone           UNIQUE
password_hash
status
created_at
updated_at
```

## 3.3 Venues

```text
venues
-------------------------
id              PK
name
address
city
capacity
created_at
```

## 3.4 Seats

```text
seats
-------------------------
id              PK
venue_id        FK → venues.id
row_number
seat_number
seat_type
created_at
```

**Example:**

```text
Venue A

A1 A2 A3 A4 A5
B1 B2 B3 B4 B5
C1 C2 C3 C4 C5
```

## 3.5 Events

```text
events
-------------------------
id              PK
name
description
category
poster_url
status
created_at
updated_at
```

## 3.6 Shows / Schedules

An event may have multiple schedules (shows).

```text
shows
-------------------------
id              PK
event_id        FK → events.id
venue_id        FK → venues.id
start_time
end_time
status
created_at
```

**Example:**

```text
Movie A

Show 1 → 10:00 AM
Show 2 → 02:00 PM
Show 3 → 06:00 PM
Show 4 → 09:00 PM
```

## 3.7 Show Seats (Critical Inventory Table)

This is the critical inventory table.

```text
show_seats
-------------------------
id              PK
show_id         FK → shows.id
seat_id         FK → seats.id
price
status
hold_token
hold_expires_at
booking_id      FK → bookings.id
version
created_at
updated_at
```

### Possible Status Values

```text
AVAILABLE
HELD
BOOKED
BLOCKED
```

### Unique Constraint

```text
UNIQUE(show_id, seat_id)
```

This prevents the same physical seat from being represented twice for the same show.

## 3.8 Bookings

```text
bookings
-------------------------
id              PK
user_id         FK → users.id
show_id         FK → shows.id
booking_reference    UNIQUE
status
subtotal
discount
total_amount
currency
expires_at
created_at
updated_at
```

### Possible Booking States

```text
PENDING
PAYMENT_PROCESSING
CONFIRMED
CANCELLED
EXPIRED
REFUNDED
```

## 3.9 Booking Items

```text
booking_items
-------------------------
id              PK
booking_id      FK → bookings.id
show_seat_id    FK → show_seats.id
price
created_at
```

## 3.10 Payments

```text
payments
-------------------------
id              PK
booking_id      FK → bookings.id
provider
provider_transaction_id
amount
currency
status
payment_method
created_at
updated_at
```

### Possible Payment States

```text
INITIATED
PROCESSING
SUCCESS
FAILED
REFUNDED
```

## 3.11 Tickets

```text
tickets
-------------------------
id              PK
booking_id      FK → bookings.id
ticket_number   UNIQUE
qr_code
status
issued_at
used_at
```

## 3.12 Database Relationships

```text
User
 │
 ├──────────────┐
 │              │
 ▼              ▼
Bookings      Reviews
 │
 ▼
Booking Items
 │
 ▼
Show Seats
 │
 └──────► Seats
             │
             ▼
           Venue

Event
 │
 ▼
Shows
 │
 ├──────► Venue
 │
 └──────► Show Seats
```

## 3.13 MySQL-Specific Considerations

- Use **InnoDB** engine for transaction support and row-level locking.
- Use **atomic `UPDATE ... WHERE status = 'AVAILABLE'`** to prevent double booking (see [Booking Domain](05-domain-booking.md)).
- Apply **`SELECT ... FOR UPDATE`** locking for multi-seat reservations within transactions.
- Use **read replicas** for reporting and non-critical read queries to reduce primary DB load.
- Ensure all foreign keys use **`ON DELETE RESTRICT`** or **`ON DELETE CASCADE`** as appropriate to maintain referential integrity.
