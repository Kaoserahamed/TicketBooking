# 14. Operations

## 14.1 Failure Scenarios

### Database Failure

```text
Primary DB
    ↓
Failure
    ↓
Failover
    ↓
Replica promoted
```

The application reconnects using a logical database endpoint (e.g., a DNS alias or cloud-managed endpoint) rather than a hard-coded individual server.

### Redis Failure

Redis should **not cause confirmed booking data loss**.

```text
Redis unavailable
      ↓
Application
      ↓
Database
```

Performance may degrade (cache misses), but **inventory correctness remains intact** because the database is the source of truth.

### Payment Gateway Timeout

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

**Do not immediately assume failure** simply because the client timed out. The payment may still succeed on the provider side. A reconciliation job can also poll the payment provider for final status.

### Notification Failure

```text
Booking SUCCESS
       ↓
Queue
       ↓
Email fails
       ↓
Retry (with backoff)
```

The booking remains **confirmed**. Notifications are best-effort and retried independently.

---

## 14.2 Consistency Model

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

### Key Principle

> **Availability information may be cached, but the final booking decision must be strongly consistent.**

The critical flow ensures that:

1. Seat availability checks are eventually consistent (cached for performance).
2. The **actual seat hold/reservation** is performed against the authoritative database with proper locking.
3. Payment confirmation is verified via webhooks, not frontend responses.
4. All state transitions are atomic transactions.

This design allows the application to scale the **stateless portions horizontally** while keeping the critical ticket-inventory operation strongly consistent.
