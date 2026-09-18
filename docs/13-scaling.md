# 13. Scaling & Performance

## 13.1 Key Architectural Decisions

| Problem | Solution |
|---|---|
| 100K users | Horizontal API scaling |
| Traffic spikes | CDN + WAF + autoscaling |
| Double booking | DB transaction + row locking / atomic update |
| Seat reservation | Temporary HOLD |
| Hold expiration | Background worker |
| Payment reliability | Provider webhook + idempotency |
| Search load | Search engine (OpenSearch) |
| Repeated reads | Redis cache |
| Email/SMS delay | Message queue |
| Ticket PDF | Object storage |
| API failure | Multiple instances |
| Database read load | Read replicas |
| Popular event overload | Waiting room / rate limiting |
| Observability | Metrics + logs + tracing |

## 13.2 Scaling Strategy

API servers should scale **horizontally** (stateless instances).

```text
API:
3–4 instances minimum

Auto-scaling:
up to 10–20 instances

Database:
MySQL primary
+ 1 read replica

Redis:
Highly available deployment

Queue:
Managed queue service (e.g., AWS SQS, RabbitMQ cluster)

Object storage:
S3 / Azure Blob

CDN:
Enabled

WAF:
Enabled
```

> These numbers are **starting points, not guarantees**. Benchmarking with realistic traffic is required before production capacity is finalized.

## 13.3 Hot Event Problem

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

This creates a **hot partition / contention** problem.

### Solutions

- CDN caching (event pages, seat maps)
- Rate limiting (IP, user, booking, payment)
- Virtual waiting room
- Redis caching
- Database row locking
- Queue-based booking

## 13.4 Virtual Waiting Room

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

Instead of allowing all users to hit the booking service simultaneously, only a controlled number are admitted at a time.

```text
100,000 waiting

↓ 1,000 users admitted

Booking System

↓

Next 1,000
```

This protects the inventory and payment systems.

## 13.5 Capacity Planning

A reasonable initial production configuration:

```text
API:
  3–4 instances minimum
  Auto-scaling up to 10–20 instances

Database:
  MySQL primary + 1 read replica

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

## 13.6 Rate Limiting

Rate limits should exist at multiple levels:

```text
IP:            100 requests/minute
User:          300 requests/minute
Booking:       10 booking attempts/minute
Payment:       5 attempts/minute
```

Popular events require additional protection.

## 13.7 Load Testing

Before production, test at least:

- 1,000 concurrent users
- 5,000 concurrent users
- 10,000 concurrent users
- 20,000 concurrent users

### Test Scenarios

#### Scenario 1 — Browsing

```text
GET events
GET event details
GET shows
```

#### Scenario 2 — Seat Selection

```text
GET seats
POST /bookings/hold
```

#### Scenario 3 — High Contention

```text
1,000 users
        ↓
  same event
        ↓
  same 100 seats
```

#### Scenario 4 — Payment

```text
Booking
→ Payment
→ Webhook
→ Confirmation
```

#### Scenario 5 — Event Launch

```text
100,000 users
        ↓
  same event
        ↓
  traffic spike
```

### Tools

- k6
- JMeter
- Locust
- Gatling

## 13.8 Future Evolution

The recommended evolution path is:

```text
Phase 1
Modular Monolith
+
MySQL
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

> **Starting with microservices is not inherently necessary.** A well-structured modular monolith with MySQL, Redis, a queue, horizontal API scaling, and careful inventory transactions can be substantially simpler to operate while still providing a path to scale.
