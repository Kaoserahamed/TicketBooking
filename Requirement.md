# System Design Document

## Ticket Booking Application

**Version:** 1.0
**Target Scale:** 100,000 registered users
**Document Type:** High-Level + Low-Level System Design
**Status:** Proposed

---

# 1. Overview

The Ticket Booking Application is a scalable web and mobile platform that allows users to discover events, view schedules and seat availability, temporarily reserve seats, make payments, and receive confirmed tickets.

The system is designed for approximately **100,000 registered users**, with significantly higher concurrency during popular-event ticket releases.

The primary architectural challenge is **preventing double booking while maintaining high availability and acceptable response times during traffic spikes**.

---

# 2. Objectives

## 2.1 Functional Objectives

The system shall allow users to:

* Register and log in.
* Browse events, movies, routes, or shows.
* Search and filter available tickets.
* View event details.
* View seat maps.
* Check real-time seat availability.
* Select seats.
* Temporarily hold selected seats.
* Make payments.
* Receive booking confirmation.
* Download/view digital tickets.
* View booking history.
* Cancel tickets according to applicable policies.
* Receive email/SMS/push notifications.

Administrators shall be able to:

* Create and manage events.
* Configure venues.
* Configure seats.
* Configure schedules/showtimes.
* Configure ticket categories and prices.
* Monitor bookings.
* Manage cancellations/refunds.
* View sales reports.
* Manage users.

---

# 3. Non-Functional Requirements

| Requirement               | Target                                   |
| ------------------------- | ---------------------------------------- |
| Registered users          | 100,000+                                 |
| Peak concurrent users     | 10,000+                                  |
| Peak booking attempts     | 1,000–5,000/sec depending on event       |
| API availability          | 99.9%+                                   |
| Normal API latency        | <300 ms                                  |
| Seat availability latency | <200 ms                                  |
| Booking confirmation      | <5 sec excluding payment-provider delays |
| Database durability       | High                                     |
| Data consistency          | Strong for seat inventory                |
| Search consistency        | Eventual consistency acceptable          |
| Horizontal scaling        | Required                                 |
| Zero double booking       | Mandatory                                |
| Secure payment handling   | Mandatory                                |

> The exact infrastructure capacity should ultimately be validated through load testing because "100K users" alone does not determine required server capacity.

---

# 4. Assumptions

The system assumes:

* 100,000 registered users.
* Approximately 10,000 peak concurrent users.
* Most users browse rather than book simultaneously.
* A popular event can cause a sudden traffic spike.
* A seat is held for approximately 5–10 minutes during checkout.
* Payment is processed through an external payment gateway.
* The application may eventually support multiple venues/events simultaneously.
* Ticket inventory is finite and must never be oversold.

---

# 5. High-Level Architecture

```text
                         ┌─────────────────────┐
                         │       Users         │
                         │ Web / Mobile App    │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │    CDN / WAF        │
                         │ Rate Limit / DDoS    │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │   Load Balancer     │
                         └──────────┬──────────┘
                                    │
              ┌─────────────────────┼─────────────────────┐
              │                     │                     │
              ▼                     ▼                     ▼
       ┌────────────┐        ┌────────────┐        ┌────────────┐
       │ API Server │        │ API Server │        │ API Server │
       │ Instance 1 │        │ Instance 2 │        │ Instance N │
       └──────┬─────┘        └──────┬─────┘        └──────┬─────┘
              │                     │                     │
              └─────────────────────┼─────────────────────┘
                                    │
             ┌──────────────────────┼─────────────────────┐
             │                      │                     │
             ▼                      ▼                     ▼
      ┌──────────────┐       ┌──────────────┐      ┌──────────────┐
      │    Redis     │       │ Message Queue│      │ Search Engine│
      │ Cache / Lock │       │ Kafka/RabbitMQ│     │ OpenSearch   │
      └───────┬──────┘       └───────┬──────┘      └──────────────┘
              │                      │
              │                      ▼
              │              ┌──────────────┐
              │              │ Notification │
              │              │   Workers    │
              │              └──────────────┘
              │
              ▼
       ┌──────────────────┐
       │ Primary Database │
       │ PostgreSQL/MySQL │
       └────────┬─────────┘
                │
                ▼
       ┌──────────────────┐
       │ Read Replicas    │
       └──────────────────┘

                External Services
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
   Payment Gateway   Email/SMS     Object Storage
```

---

# 6. Major Components

## 6.1 Client Applications

### Web

Recommended:

* React / Next.js
* TypeScript
* Tailwind CSS

### Mobile

Possible:

* Android — Kotlin
* iOS — Swift
* Cross-platform — Flutter/React Native

The client should never be responsible for determining whether a seat is actually available.

The backend is the source of truth.

---

# 7. CDN and WAF

A CDN should serve:

* JavaScript
* CSS
* Images
* Event posters
* Static assets

The WAF should provide:

* DDoS protection
* IP filtering
* Bot protection
* Request rate limiting
* Malicious request detection

Example:

```text
User
  ↓
CloudFront / Azure Front Door
  ↓
WAF
  ↓
Load Balancer
```

---

# 8. Load Balancer

The load balancer distributes requests across multiple API instances.

Example:

```text
                  Load Balancer
                       │
       ┌───────────────┼───────────────┐
       ▼               ▼               ▼
    API-01           API-02          API-03
```

API servers should be **stateless**.

This allows new instances to be added horizontally.

---

# 9. Backend Architecture

A modular monolith is sufficient for the initial 100K-user scale.

Recommended structure:

```text
Backend
│
├── auth
├── users
├── events
├── venues
├── schedules
├── seats
├── inventory
├── bookings
├── payments
├── tickets
├── notifications
├── refunds
├── admin
└── reports
```

Possible technology stack:

```text
API:
FastAPI / Node.js / Spring Boot

Database:
PostgreSQL

Cache:
Redis

Queue:
RabbitMQ / Kafka / SQS

Search:
OpenSearch / Elasticsearch

Object Storage:
S3 / Azure Blob Storage

Container:
Docker

Deployment:
Kubernetes / ECS / Azure Container Apps
```

---

# 10. Database Design

PostgreSQL is recommended because ticket booking requires strong transactional guarantees.

## 10.1 Users

```text
users
-------------------------
id PK
name
email UNIQUE
phone UNIQUE
password_hash
status
created_at
updated_at
```

---

## 10.2 Venues

```text
venues
-------------------------
id PK
name
address
city
capacity
created_at
```

---

## 10.3 Seats

```text
seats
-------------------------
id PK
venue_id FK
row_number
seat_number
seat_type
created_at
```

Example:

```text
Venue A

A1 A2 A3 A4 A5
B1 B2 B3 B4 B5
C1 C2 C3 C4 C5
```

---

# 11. Events

```text
events
-------------------------
id PK
name
description
category
poster_url
status
created_at
updated_at
```

---

# 12. Shows / Schedules

An event may have multiple schedules.

```text
shows
-------------------------
id PK
event_id FK
venue_id FK
start_time
end_time
status
created_at
```

Example:

```text
Movie A

Show 1 → 10:00 AM
Show 2 → 02:00 PM
Show 3 → 06:00 PM
Show 4 → 09:00 PM
```

---

# 13. Show Seats

This is the critical inventory table.

```text
show_seats
-------------------------
id PK
show_id FK
seat_id FK
price
status
hold_token
hold_expires_at
booking_id
version
created_at
updated_at
```

Possible status:

```text
AVAILABLE
HELD
BOOKED
BLOCKED
```

Unique constraint:

```text
UNIQUE(show_id, seat_id)
```

This prevents the same physical seat from being represented twice for the same show.

---

# 14. Bookings

```text
bookings
-------------------------
id PK
user_id FK
show_id FK
booking_reference UNIQUE
status
subtotal
discount
total_amount
currency
expires_at
created_at
updated_at
```

Possible states:

```text
PENDING
PAYMENT_PROCESSING
CONFIRMED
CANCELLED
EXPIRED
REFUNDED
```

---

# 15. Booking Items

```text
booking_items
-------------------------
id PK
booking_id FK
show_seat_id FK
price
created_at
```

---

# 16. Payments

```text
payments
-------------------------
id PK
booking_id FK
provider
provider_transaction_id
amount
currency
status
payment_method
created_at
updated_at
```

Possible states:

```text
INITIATED
PROCESSING
SUCCESS
FAILED
REFUNDED
```

---

# 17. Tickets

```text
tickets
-------------------------
id PK
booking_id FK
ticket_number UNIQUE
qr_code
status
issued_at
used_at
```

---

# 18. Database Relationships

```text
User
 │
 ├───────────────┐
 │               │
 ▼               ▼
Bookings       Reviews
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

---

# 19. The Most Important Problem: Double Booking

Consider:

```text
Seat A1
```

Two users simultaneously click it.

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

Result:

```text
DOUBLE BOOKING
```

This must never happen.

---

# 20. Seat Locking Strategy

The recommended approach is:

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

Example:

```text
Seat: A1

Status: HELD
Hold Token: abc123
Expires: 18:57:00
```

The user receives approximately 5–10 minutes to complete payment.

---

# 21. Atomic Seat Reservation

The reservation must be atomic.

Conceptually:

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

Then check:

```text
Rows affected = 1
    → Successfully held

Rows affected = 0
    → Seat unavailable
```

For multiple seats, perform the operation inside a database transaction.

---

# 22. Alternative: Row-Level Lock

PostgreSQL can use:

```sql
SELECT *
FROM show_seats
WHERE show_id = :show_id
AND seat_id IN (...)
FOR UPDATE;
```

Then:

```text
BEGIN TRANSACTION

Lock seats

Check availability

Change AVAILABLE → HELD

Create booking

COMMIT
```

This prevents concurrent transactions from modifying the same rows incorrectly.

---

# 23. Redis Usage

Redis should **not replace the primary database as the authoritative ticket inventory**.

Redis can be used for:

* Event caching
* Seat availability cache
* Session data
* Rate limiting
* Distributed locks where appropriate
* Temporary hold metadata
* Frequently accessed event information

Example:

```text
Redis

event:123
event:123:shows
show:456:availability
rate:user:789
```

The database remains the source of truth for confirmed inventory.

---

# 24. Seat Hold Expiration

Suppose:

```text
User selects A1

18:50
↓
A1 = HELD

Expiry:
18:55
```

A background worker periodically finds expired holds:

```text
HELD
  │
  │ expiry reached
  ▼
AVAILABLE
```

Possible implementation:

```text
Redis delayed queue
        OR
RabbitMQ
        OR
scheduled worker
        OR
database polling
```

For a 100K-user application, a worker-based approach is sufficient.

---

# 25. Booking Flow

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
Payment Page
 │
 ▼
Payment Gateway
 │
 ▼
Webhook
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

---

# 26. Payment Architecture

Never trust only the frontend payment response.

Bad approach:

```text
Frontend
   ↓
Payment successful
   ↓
Frontend tells backend
   ↓
Backend confirms booking
```

The frontend can be manipulated.

Preferred:

```text
User
 ↓
Payment Gateway
 ↓
Payment Provider
 ↓
Secure Webhook
 ↓
Backend
 ↓
Verify transaction
 ↓
Confirm booking
```

The backend should verify:

* Transaction ID
* Amount
* Currency
* Merchant ID
* Payment status
* Booking ID
* Signature/webhook authenticity

---

# 27. Idempotency

Payment and booking APIs must be idempotent.

Example:

```http
POST /api/bookings
Idempotency-Key: 8f72c...
```

If the request is accidentally sent twice:

```text
Request 1 → Booking #1001
Request 2 → Same Booking #1001
```

instead of:

```text
Booking #1001
Booking #1002
```

---

# 28. API Design

## Authentication

```http
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
```

## Events

```http
GET /api/v1/events
GET /api/v1/events/{id}
GET /api/v1/events/{id}/shows
```

## Seats

```http
GET /api/v1/shows/{id}/seats
GET /api/v1/shows/{id}/availability
```

## Booking

```http
POST /api/v1/bookings/hold
GET /api/v1/bookings/{id}
POST /api/v1/bookings/{id}/cancel
```

## Payment

```http
POST /api/v1/payments/create
POST /api/v1/payments/webhook
GET /api/v1/payments/{id}
```

## Tickets

```http
GET /api/v1/tickets/{id}
GET /api/v1/tickets/{id}/qr
```

---

# 29. Search Architecture

Do not perform complex event searches directly against the primary database at high traffic.

Use:

```text
PostgreSQL
     │
     │ Event changes
     ▼
Message Queue
     │
     ▼
Search Index
     │
     ▼
OpenSearch
```

Search fields:

```text
Event name
Category
Location
Date
Venue
Price
Language
Tags
```

Search can be eventually consistent because a newly created event does not need millisecond-level consistency.

---

# 30. Caching Strategy

Cache highly requested data:

```text
Event details
Venue information
Seat layout
Show metadata
Popular events
Categories
Locations
```

Example:

```text
GET /events/100

        │
        ▼
      Redis
        │
   ┌────┴────┐
   │         │
 Cache Hit  Cache Miss
   │         │
   ▼         ▼
 Return   PostgreSQL
              │
              ▼
            Redis
```

---

# 31. Important Cache Rule

Do not blindly cache booking state.

For example:

```text
Redis:
Seat A1 = AVAILABLE
```

But the database might already contain:

```text
Seat A1 = BOOKED
```

Therefore:

**Confirmed booking operations must always validate against the authoritative inventory state.**

---

# 32. Message Queue

Use asynchronous processing for operations that do not need to block the booking request.

Example:

```text
Booking Confirmed
       │
       ▼
Message Queue
       │
 ┌─────┼────────┐
 ▼     ▼        ▼
Email  SMS     Push
```

Other queue jobs:

* Ticket generation
* Email
* SMS
* Analytics
* Refund processing
* Search indexing
* Expired booking cleanup

---

# 33. Notification Service

Notification service consumes messages:

```text
BookingConfirmedEvent

{
    booking_id,
    user_id,
    email,
    ticket_id
}
```

Then:

```text
Email Worker → Email provider
SMS Worker   → SMS provider
Push Worker  → Push provider
```

A failure in email delivery should not cancel a successful booking.

---

# 34. Ticket Generation

After successful payment:

```text
Booking
   │
   ▼
Ticket Service
   │
   ├── Generate ticket number
   ├── Generate QR code
   └── Generate PDF
```

Store PDFs in object storage:

```text
S3 / Azure Blob Storage
```

Database stores:

```text
ticket_id
ticket_number
storage_url
qr_code
```

---

# 35. QR Code Validation

At venue entry:

```text
Scanner
   │
   ▼
POST /tickets/validate
   │
   ▼
Backend
   │
   ├── Verify ticket
   ├── Check status
   ├── Check event
   └── Mark USED
```

The ticket should transition:

```text
ISSUED → USED
```

The operation must be atomic to prevent the same ticket from being used twice.

---

# 36. Authentication and Authorization

Use:

```text
JWT access token
+
Refresh token
```

Roles:

```text
USER
ADMIN
EVENT_MANAGER
VENUE_MANAGER
SUPPORT
```

Authorization should be enforced server-side.

Example:

```text
/admin/events
```

must not be protected only through frontend route hiding.

---

# 37. Security Requirements

Implement:

* HTTPS everywhere
* Secure password hashing
* JWT expiration
* Refresh-token rotation
* RBAC
* Input validation
* SQL injection protection
* XSS protection
* CSRF protection where applicable
* Rate limiting
* WAF
* Security headers
* Audit logging
* Secrets management
* Encryption at rest
* Encryption in transit

Never store:

```text
Raw card number
CVV
Payment password
```

unless the architecture and compliance requirements explicitly support it; preferably let the payment provider handle sensitive card data.

---

# 38. Rate Limiting

Rate limits should exist at multiple levels.

Example:

```text
IP:
100 requests/minute

User:
300 requests/minute

Booking:
10 booking attempts/minute

Payment:
5 attempts/minute
```

Popular events require additional protection.

---

# 39. Hot Event Problem

Suppose:

```text
Concert
Capacity = 20,000

100,000 users
        ↓
all try to buy
        ↓
same event
        ↓
same seats
```

This creates a hot partition / contention problem.

Solutions:

```text
CDN caching
+
Rate limiting
+
Virtual waiting room
+
Redis caching
+
Database row locking
+
Queue-based booking
```

---

# 40. Virtual Waiting Room

For extremely popular events:

```text
100,000 users
       │
       ▼
Waiting Room
       │
       ▼
Controlled traffic
       │
       ▼
Booking System
```

Instead of allowing all users to hit the booking service simultaneously, only a controlled number are allowed through.

Example:

```text
100,000 waiting

↓ 1,000 users admitted

Booking System

↓
Next 1,000
```

This protects the inventory and payment systems.

---

# 41. Scaling Strategy

API servers should scale horizontally.

Example:

```text
Normal:

3 API instances


Peak:

10–20 API instances
```

The actual number should be determined through load testing.

Auto-scaling metrics:

```text
CPU
Memory
Request rate
Response latency
Queue depth
Active connections
```

---

# 42. Database Scaling

Start with:

```text
Primary PostgreSQL
+
Read Replica
```

Writes:

```text
Primary
```

Reads:

```text
Read Replica
```

But inventory writes must go to the primary.

Example:

```text
                    PostgreSQL
                       │
                 ┌─────┴─────┐
                 ▼           ▼
              Primary      Replica
                 │
               WRITE       READ
```

---

# 43. Database Indexes

Important indexes:

```sql
users(email)

users(phone)

events(category)

events(status)

shows(event_id, start_time)

show_seats(show_id, status)

bookings(user_id, created_at)

bookings(booking_reference)

payments(booking_id)

tickets(ticket_number)
```

For inventory:

```sql
CREATE UNIQUE INDEX
idx_show_seat
ON show_seats(show_id, seat_id);
```

---

# 44. Partitioning

At larger scale, bookings can eventually be partitioned by:

```text
created_at
```

or another suitable access pattern.

For example:

```text
bookings_2026_01
bookings_2026_02
bookings_2026_03
```

However, partitioning should be introduced based on measured database workload rather than simply because the application has 100K users.

---

# 45. Observability

The system should expose:

### Metrics

```text
Requests/sec
Error rate
P95 latency
P99 latency
Database CPU
Database connections
Redis memory
Queue depth
Booking success rate
Payment failure rate
Seat-hold expiration rate
```

### Logs

Centralized logging:

```text
Application
   ↓
Log Collector
   ↓
Central Log System
```

### Tracing

Use distributed tracing for:

```text
API
 ↓
Database
 ↓
Payment
 ↓
Queue
 ↓
Notification
```

Possible technologies:

```text
OpenTelemetry
Prometheus
Grafana
ELK/OpenSearch
```

---

# 46. Monitoring Dashboard

Important dashboard panels:

```text
┌─────────────────────────────────────────┐
│ Requests/sec             2,450          │
│ P95 Latency              180 ms         │
│ Error Rate               0.12%          │
│ Active Users             8,421          │
│ Booking Attempts         720/sec        │
│ Successful Bookings      612/sec        │
│ Payment Failures         1.8%           │
│ Queue Depth              142            │
│ DB Connections            72/200         │
└─────────────────────────────────────────┘
```

---

# 47. Disaster Recovery

Recommended:

```text
Primary Region
      │
      ├── Application
      ├── Database
      └── Redis
             │
             ▼
      Backup / Replica
```

Database:

* Automated backups
* Point-in-time recovery
* Replication
* Backup retention

Object storage:

* Versioning
* Replication
* Lifecycle policies

---

# 48. Backup Strategy

Example:

```text
Daily full backup
+
Continuous transaction/WAL backup
+
Weekly long-term backup
```

Define:

### RPO

Maximum acceptable data loss.

Example:

```text
RPO ≤ 5 minutes
```

### RTO

Maximum acceptable recovery time.

Example:

```text
RTO ≤ 30 minutes
```

These are target values and should be validated against business requirements.

---

# 49. Deployment Architecture

A cloud deployment could look like:

```text
                 Internet
                    │
                    ▼
              CDN + WAF
                    │
                    ▼
             Load Balancer
                    │
          ┌─────────┼─────────┐
          ▼         ▼         ▼
        API-1     API-2     API-3
          │         │         │
          └─────────┼─────────┘
                    │
       ┌────────────┼────────────┐
       ▼            ▼            ▼
     Redis       PostgreSQL     Queue
                    │
                    ▼
               Read Replica
```

Cloud options:

### AWS

```text
CloudFront
WAF
ALB
ECS/EKS
RDS PostgreSQL
ElastiCache Redis
SQS/SNS or MSK
S3
CloudWatch
```

### Azure

```text
Azure Front Door
WAF
Application Gateway
Container Apps / AKS
Azure Database for PostgreSQL
Azure Cache for Redis
Service Bus
Blob Storage
Application Insights
```

---

# 50. CI/CD

Recommended pipeline:

```text
Developer
    │
    ▼
Git Push
    │
    ▼
GitHub Actions
    │
    ├── Lint
    ├── Unit Tests
    ├── Integration Tests
    ├── Security Scan
    ├── Docker Build
    └── Push Image
             │
             ▼
          Registry
             │
             ▼
       Deployment
             │
             ▼
      Staging Environment
             │
             ▼
        Approval
             │
             ▼
       Production
```

---

# 51. Environment Structure

```text
Development
     ↓
Testing
     ↓
Staging
     ↓
Production
```

Each environment should have separate:

* Database
* Redis
* Secrets
* Payment credentials
* Storage
* Monitoring configuration

---

# 52. Repository Structure

```text
ticket-booking/
│
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── auth/
│   │   ├── users/
│   │   ├── events/
│   │   ├── venues/
│   │   ├── shows/
│   │   ├── seats/
│   │   ├── inventory/
│   │   ├── bookings/
│   │   ├── payments/
│   │   ├── tickets/
│   │   ├── notifications/
│   │   ├── refunds/
│   │   ├── admin/
│   │   ├── database/
│   │   └── main.py
│   │
│   ├── tests/
│   ├── Dockerfile
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── features/
│   │   ├── services/
│   │   └── hooks/
│   ├── tests/
│   └── Dockerfile
│
├── infrastructure/
│   ├── terraform/
│   ├── kubernetes/
│   └── scripts/
│
├── docs/
│   ├── architecture/
│   │   ├── system-design.md
│   │   ├── database-design.md
│   │   └── api-design.md
│   │
│   ├── security/
│   ├── deployment/
│   ├── operations/
│   └── disaster-recovery/
│
├── .github/
│   └── workflows/
│
├── docker-compose.yml
├── README.md
└── LICENSE
```

---

# 53. Important Failure Scenarios

## Database Failure

```text
Primary DB
    ↓
Failure
    ↓
Failover
    ↓
Replica promoted
```

Application reconnects using the database endpoint rather than a hard-coded individual server.

---

## Redis Failure

Redis should not cause confirmed booking data loss.

```text
Redis unavailable
      ↓
Application
      ↓
Database
```

Performance may degrade, but inventory correctness remains intact.

---

## Payment Gateway Timeout

```text
Payment initiated
       ↓
Gateway timeout
       ↓
Booking = PAYMENT_PROCESSING
       ↓
Webhook / reconciliation
       ↓
SUCCESS / FAILED
```

Do not immediately assume failure simply because the client timed out.

---

## Notification Failure

```text
Booking SUCCESS
       ↓
Queue
       ↓
Email fails
       ↓
Retry
```

Booking remains confirmed.

---

# 54. Booking State Machine

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

---

# 55. Consistency Model

Different parts of the system can use different consistency models.

| Component              | Consistency |
| ---------------------- | ----------- |
| Seat inventory         | Strong      |
| Booking status         | Strong      |
| Payment                | Strong      |
| Ticket issuance        | Strong      |
| User profile           | Strong      |
| Event search           | Eventual    |
| Analytics              | Eventual    |
| Notifications          | Eventual    |
| Popular-event counters | Eventual    |

The key principle is:

> **Availability information may be cached, but the final booking decision must be strongly consistent.**

---

# 56. Capacity Planning

A reasonable initial production configuration might be:

```text
API:
3–4 instances minimum

Auto-scaling:
up to 10–20 instances

Database:
PostgreSQL primary
+
1 read replica

Redis:
Highly available deployment

Queue:
Managed queue service

Object storage:
S3 / Azure Blob

CDN:
Enabled

WAF:
Enabled
```

These numbers are **starting points, not guarantees**. Benchmarking with realistic traffic is required before production capacity is finalized.

---

# 57. Load Testing

Before production, test at least:

```text
1,000 concurrent users
5,000 concurrent users
10,000 concurrent users
20,000 concurrent users
```

Test scenarios:

### Scenario 1 — Browsing

```text
GET events
GET event details
GET shows
```

### Scenario 2 — Seat Selection

```text
GET seats
POST hold
```

### Scenario 3 — High Contention

```text
1,000 users
        ↓
same event
        ↓
same 100 seats
```

### Scenario 4 — Payment

```text
Booking
→ Payment
→ Webhook
→ Confirmation
```

### Scenario 5 — Event Launch

```text
100,000 users
        ↓
same event
        ↓
traffic spike
```

Tools:

```text
k6
JMeter
Locust
Gatling
```

---

# 58. Key Architectural Decisions

| Problem                | Solution                                   |
| ---------------------- | ------------------------------------------ |
| 100K users             | Horizontal API scaling                     |
| Traffic spikes         | CDN + WAF + autoscaling                    |
| Double booking         | DB transaction + row locking/atomic update |
| Seat reservation       | Temporary HOLD                             |
| Hold expiration        | Background worker                          |
| Payment reliability    | Provider webhook + idempotency             |
| Search load            | Search engine                              |
| Repeated reads         | Redis                                      |
| Email/SMS delay        | Message queue                              |
| Ticket PDF             | Object storage                             |
| API failure            | Multiple instances                         |
| Database read load     | Read replicas                              |
| Popular event overload | Waiting room/rate limiting                 |
| Observability          | Metrics + logs + tracing                   |

---

# 59. Core Design Principle

The most important part of the system is not the number of API servers.

It is the **inventory consistency model**.

The critical flow should be:

```text
                  ┌──────────────────┐
                  │ User selects seat│
                  └────────┬─────────┘
                           ▼
                    ┌─────────────┐
                    │ API Server  │
                    └──────┬──────┘
                           ▼
                 ┌──────────────────┐
                 │ DB Transaction   │
                 │                  │
                 │ Lock/atomic      │
                 │ availability     │
                 └────────┬─────────┘
                          │
                 ┌────────┴────────┐
                 │                 │
              Available         Unavailable
                 │                 │
                 ▼                 ▼
               HOLD             Reject
                 │
                 ▼
              Payment
                 │
          ┌──────┴──────┐
          ▼             ▼
       Success         Failed
          │             │
          ▼             ▼
       BOOKED        RELEASE HOLD
          │
          ▼
        TICKET
```

This design allows the application to scale the **stateless portions horizontally** while keeping the critical ticket-inventory operation strongly consistent.

# 60. Future Evolution

The recommended evolution path is:

```text
Phase 1
Modular Monolith
+
PostgreSQL
+
Redis
+
Queue

        ↓

Phase 2
Horizontal API scaling
+
Read replica
+
Search engine

        ↓

Phase 3
Waiting room
+
Advanced autoscaling
+
Distributed observability

        ↓

Phase 4
Extract high-load services

Booking Service
Payment Service
Ticket Service
Notification Service
Search Service

        ↓

Phase 5
Multi-region architecture
+
Advanced disaster recovery
+
Global CDN
```

For a 100K-user application, **starting with microservices is not inherently necessary**. A well-structured modular monolith with PostgreSQL, Redis, a queue, horizontal API scaling, and careful inventory transactions can be substantially simpler to operate while still providing a path to scale.
