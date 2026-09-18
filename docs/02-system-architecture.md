# 2. System Architecture

## 2.1 High-Level Architecture

```text
                      ┌─────────────────────┐
                            Client
                            (Web/Mobile)
                              │
                              ▼
               ┌──────────────────────────┐
               │         CDN + WAF        │
               │ (CloudFront / Front Door)│
               └─────────────┬────────────┘
                             │
                             ▼
               ┌──────────────────────────┐
               │     Load Balancer        │
               │ (ALB / Application Gate) │
               └─────────────┬────────────┘
                             │
               ┌─────────────┼─────────────┐
               ▼             ▼              ▼
            API-01        API-02         API-03
        (Node.js/Express)(Node.js/Express)(Node.js/Express)
              │              │              │
     ┌────────┼──────┐       │     ┌────────┼────────┐
     ▼              ▼             ▼              ▼
┌──────────┐┌────────────┐┌────────────┐┌────────────┐
│   Redis  ││ Message Q  ││Search Engine││Object Store│
│Cache/Lock││Kafka/Rabbit││OpenSearch  ││S3/Blob     │
└──────────┘└────────────┘└────────────┘└────────────┘
     │              │
     │              │
     │              ▼
     │     ┌──────────────────┐
     │     │ Notification     │
     │     │    Workers       │
     │     └──────────────────┘
     │
     ▼
┌──────────────────┐
│ Primary Database │
│   MySQL          │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Read Replicas    │
└──────────────────┘

        External Services
               │
   ┌───────────┼───────────┐
   ▼           ▼           ▼
Payment Gateway  Email/SMS   Object Storage
```

## 2.2 CDN and WAF

A **CDN** should serve:

- JavaScript bundles (compiled by Vite)
- CSS
- Images
- Event posters
- Static assets

A **WAF** should provide:

- DDoS protection
- IP filtering
- Bot protection
- Request rate limiting
- Malicious request detection

```text
User
  ↓
CloudFront / Azure Front Door
  ↓
WAF
  ↓
Load Balancer
```

## 2.3 Load Balancer

The load balancer distributes requests across multiple API instances.

```text
                  Load Balancer
                       │
       ┌───────────────┼───────────────┐
       ▼               ▼               ▼
    API-01          API-02          API-03
```

API servers should be **stateless**, which allows new instances to be added horizontally.

## 2.4 Backend Architecture

A **modular monolith** is sufficient for the initial 100K-user scale.

Recommended module structure (Node.js + Express.js):

```text
Backend
│
├── auth          (registration, login, refresh, logout)
├── users         (profile management)
├── events        (event CRUD)
├── venues        (venue configuration)
├── schedules     (showtime configuration)
├── seats         (seat layout / seat config)
├── inventory     (seat availability & hold logic)
├── bookings      (booking creation, cancellation)
├── payments      (payment creation, webhook handling)
├── tickets       (ticket issuance, QR generation)
├── notifications (email/SMS/push dispatch)
├── refunds       (cancellation/refund processing)
├── admin         (admin dashboard data)
└── reports       (sales analytics)
```

### Technology Stack (Recommended)

```text
API:      Node.js + Express.js
Database: MySQL
Cache:    Redis
Queue:    RabbitMQ / Kafka / SQS
Search:   OpenSearch / Elasticsearch
Storage:  S3 / Azure Blob Storage
Container: Docker
Deployment: Kubernetes / ECS / Azure Container Apps
```

> **Frontend recommendation:** React + TypeScript + Vite for a fast, type-safe single-page application.
