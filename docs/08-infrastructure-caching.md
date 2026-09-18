# 8. Caching Strategy

## 8.1 Redis Usage

Redis should **not replace the primary database** as the authoritative ticket inventory.

### Redis Use Cases

- Event caching
- Seat availability cache
- Session data
- Rate limiting
- Distributed locks where appropriate
- Temporary hold metadata
- Frequently accessed event information

### Example Redis Keys

```text
Redis

event:123
event:123:shows
show:456:availability
rate:user:789
```

The database remains the **source of truth** for confirmed inventory.

## 8.2 Caching Strategy

Cache highly requested data to reduce database load:

- Event details
- Venue information
- Seat layout
- Show metadata
- Popular events
- Categories
- Locations

### Cache Flow

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
Return    PostgreSQL/MySQL
              │
              ▼
            Redis
```

## 8.3 Important Cache Rule

**Do not blindly cache booking state.**

For example:

```text
Redis:
Seat A1 = AVAILABLE
```

But the database might already contain:

```text
Seat A1 = BOOKED
```

### Key Principle

> **Availability information may be cached, but the final booking decision must always validate against the authoritative inventory state in the database.**

Confirmed booking operations must always check the database, not just the cache.
