# Ticket Booking System

A scalable ticket booking web application built with **MySQL**, **Node.js + Express.js**, and **React + TypeScript + Vite**.

> **Documentation:** See the [`docs/`](docs/) directory for the full system design documentation.

## Quick Start

### Prerequisites

- Node.js 18+
- MySQL 8+
- Redis
- Docker (optional, for containerized development)

### Development Setup

```bash
# Clone the repository
git clone <repo-url>
cd ticket-booking

# Backend
cd backend
npm install
npm run dev    # starts Express server on http://localhost:4000

# Frontend
cd ../frontend
npm install
npm run dev    # starts Vite dev server on http://localhost:5173

# Start MySQL & Redis with Docker (optional)
docker-compose up -d
```

### Environment Variables

Copy `.env.example` to `.env` and configure:

```env
# Database
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=ticket_booking

# Redis
REDIS_URL=redis://localhost:6379

# Auth
JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_refresh_secret
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Payment
PAYMENT_GATEWAY=stripe
STRIPE_SECRET_KEY=your_stripe_key
STRIPE_WEBHOOK_SECRET=your_webhook_secret

# Email / SMS
SMTP_HOST=smtp.your-provider.com
SMS_PROVIDER=twilio
```

## Database Tests

The SQL test/verification scripts in [`tests/sql`](tests/sql/) cover user auth, events,
venues/seats, shows, availability, the booking flow, payments, tickets, admin reports,
concurrency (double-booking prevention) and background workers.

```powershell
# Run every test script against the database configured in .env
.\tests\run-sql-tests.ps1

# Recreate the database from infrastructure/database/schema.sql first
# (needed when the seed data already exists — makes the suite repeatable)
.\tests\run-sql-tests.ps1 -Fresh

# Run against another database
.\tests\run-sql-tests.ps1 -Fresh -Database ticket_booking_test
```

With `-Fresh` the runner recreates the database from
[`infrastructure/database/schema.sql`](infrastructure/database/schema.sql), then runs
each file in `tests/sql/` in order. A file FAILS when MySQL reports any error, and the
script exits with code 0 only when all files pass.

## Documentation

| # | Document | Topic |
|---|----------|-------|
| 01 | [Overview](docs/01-overview.md) | Project overview, objectives, NFRs, assumptions |
| 02 | [System Architecture](docs/02-system-architecture.md) | High-level arch, components, CDN/WAF, LB, backend |
| 03 | [Database Design](docs/03-database-design.md) | Schema, tables, relationships (MySQL) |
| 04 | [API Design](docs/04-api-design.md) | REST endpoints and design conventions |
| 05 | [Booking Domain](docs/05-domain-booking.md) | Double-booking prevention, seat locking, flow, state machine |
| 06 | [Payment Domain](docs/06-domain-payment.md) | Payment architecture, webhooks, idempotency |
| 07 | [Tickets Domain](docs/07-domain-tickets.md) | Ticket generation, QR validation |
| 08 | [Caching](docs/08-infrastructure-caching.md) | Redis usage and caching strategy |
| 09 | [Search](docs/09-infrastructure-search.md) | Search architecture and indexing |
| 10 | [Notifications](docs/10-infrastructure-notifications.md) | Message queue and notification service |
| 11 | [Security](docs/11-security.md) | Auth, authorization, security controls, rate limiting |
| 12 | [Deployment](docs/12-deployment.md) | Deployment, CI/CD, environments, repo structure |
| 13 | [Scaling](docs/13-scaling.md) | Hot events, waiting room, capacity, load testing, evolution |
| 14 | [Operations](docs/14-operations.md) | Failure scenarios and consistency model |

Start with the [Documentation README](docs/README.md) for an introduction.

---

## Architecture Summary

The system is designed for **100,000+ registered users** with **10,000+ peak concurrent users**. The primary architectural challenge is **preventing double booking** while maintaining high availability during traffic spikes.

Key design decisions:
- **Atomic seat reservation** using MySQL transactions with row-level locking
- **Temporary seat holds** (5–10 min) with background cleanup workers
- **Payment verification via secure webhooks** (never trust the frontend)
- **Idempotent booking & payment APIs**
- **Redis caching** for read-heavy operations (DB is source of truth)
- **Horizontal API scaling** with stateless Express servers

See [docs/README.md](docs/README.md) for the full documentation index.