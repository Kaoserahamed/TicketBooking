# 12. Deployment

## 12.1 Deployment Architecture

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
         API-1    API-2    API-3
           │         │         │
           └─────────┼─────────┘
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
      Redis       MySQL         Queue
                     │
                     ▼
                Read Replica
```

### Cloud Options

#### AWS

```text
CloudFront
WAF
ALB
ECS/EKS
RDS MySQL
ElastiCache Redis
SQS/SNS or MSK
S3
CloudWatch
```

#### Azure

```text
Azure Front Door
WAF
Application Gateway
Container Apps / AKS
Azure Database for MySQL
Azure Cache for Redis
Service Bus
Blob Storage
Application Insights
```

## 12.2 CI/CD Pipeline

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
     ├── Package Frontend (Vite build)
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

## 12.3 Environment Structure

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

- Database
- Redis
- Secrets
- Payment credentials
- Storage
- Monitoring configuration

## 12.4 Repository Structure

```text
ticket-booking/
│
├── backend/
│   ├── src/
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
│   │   └── index.ts          (Express app entry point)
│   │
│   ├── tests/
│   ├── Dockerfile
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── features/
│   │   ├── services/
│   │   └── hooks/
│   ├── tests/
│   ├── Dockerfile
│   └── vite.config.ts
│
├── infrastructure/
│   ├── terraform/
│   ├── kubernetes/
│   └── scripts/
│
├── docs/
│   ├── 01-overview.md
│   ├── 02-system-architecture.md
│   ├── 03-database-design.md
│   ├── 04-api-design.md
│   ├── 05-domain-booking.md
│   ├── 06-domain-payment.md
│   ├── 07-domain-tickets.md
│   ├── 08-infrastructure-caching.md
│   ├── 09-infrastructure-search.md
│   ├── 10-infrastructure-notifications.md
│   ├── 11-security.md
│   ├── 12-deployment.md
│   ├── 13-scaling.md
│   ├── 14-operations.md
│   └── README.md
│
├── docker-compose.yml
├── README.md
└── LICENSE
```
