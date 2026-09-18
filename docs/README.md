# Ticket Booking System — Documentation

**Version:** 1.0  
**Target Scale:** 100,000+ registered users  
**Tech Stack:** MySQL, Node.js + Express.js, React + TypeScript + Vite  
**Status:** Proposed

---

## Table of Contents

| # | Document | Topic |
|---|----------|-------|
| 01 | [Overview](01-overview.md) | Project overview, objectives, non-functional requirements, assumptions |
| 02 | [System Architecture](02-system-architecture.md) | High-level architecture, major components, CDN/WAF, load balancer, backend structure |
| 03 | [Database Design](03-database-design.md) | Schema, tables, and relationships (MySQL) |
| 04 | [API Design](04-api-design.md) | REST API endpoints and design conventions |
| 05 | [Booking Domain](05-domain-booking.md) | Double-booking prevention, seat locking, booking flow, state machine |
| 06 | [Payment Domain](06-domain-payment.md) | Payment architecture, webhook handling, idempotency |
| 07 | [Tickets Domain](07-domain-tickets.md) | Ticket generation, QR code validation |
| 08 | [Caching](08-infrastructure-caching.md) | Redis usage and caching strategy |
| 09 | [Search](09-infrastructure-search.md) | Search architecture and indexing |
| 10 | [Notifications](10-infrastructure-notifications.md) | Message queue and notification service |
| 11 | [Security](11-security.md) | Authentication, authorization, security controls, rate limiting |
| 12 | [Deployment](12-deployment.md) | Deployment architecture, CI/CD, environments, repository structure |
| 13 | [Scaling](13-scaling.md) | Hot-event handling, waiting room, capacity planning, load testing, evolution |
| 14 | [Operations](14-operations.md) | Failure scenarios and consistency model |

---

## Quick Summary

The Ticket Booking Application is a scalable web platform that allows users to:

- **Discover** events, shows, and schedules
- **Check** real-time seat availability
- **Select** and **temporarily reserve** seats
- **Pay** securely via an external payment gateway
- **Receive** confirmed digital tickets
- **Manage** booking history and cancellations

Administrators can create/manage events, configure venues and seats, monitor bookings, manage cancellations, and view sales reports.

### Critical Challenge

The primary architectural challenge is **preventing double booking** while maintaining high availability and acceptable response times during traffic spikes (e.g., popular event launches).

### Core Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + TypeScript + Vite |
| Backend | Node.js + Express.js |
| Database | MySQL |
| Cache | Redis |
| Message Queue | RabbitMQ / Kafka |
| Search | OpenSearch / Elasticsearch |
| Object Storage | S3 / Azure Blob Storage |
| Container | Docker |
| Deployment | Kubernetes / ECS / Azure Container Apps |

> **See [Overview](01-overview.md)** for detailed objectives and requirements.
