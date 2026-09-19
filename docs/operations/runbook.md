# Runbook

Day-to-day operations for TicketBooking. Unit tests need no DB; every runtime
(dev, staging, prod) uses MySQL 8.

Companions: [`monitoring.md`](monitoring.md) (signals),
[`disaster-recovery.md`](disaster-recovery.md) (backups),
[`../deployment/rollback.md`](../deployment/rollback.md) (bad release),
[`../deployment/production.md`](../deployment/production.md) (deploy).

## Environments

| Concern   | Backend                                                 | Frontend                          |
| --------- | ------------------------------------------------------- | --------------------------------- |
| Local API | `npm run dev` (:4000)                                   | `npm run dev` (:5173)             |
| Env files | `.env` from `.env.example`                              | same origin via vite proxy `/api` |
| Database  | `docker compose up -d mysql`, then `npm run db:migrate` | — (calls the API)                 |

## Releases and container images

- Cut a release from `main` when CI is green: annotated tag `vX.Y.Z`, push
  `main` and the tag. Checklist: [`../deployment/ci-cd.md`](../deployment/ci-cd.md).
- The tag re-runs the backend/frontend/sql/manifests/docker gates; GHCR publish
  happens on `main` pushes (see `ci.yml`).
- Rollback: redeploy the previous image tag;
  [`../deployment/rollback.md`](../deployment/rollback.md) explains why
  migrations roll forward, never down.

## Database

```bash
cd backend
npm run db:migrate        # apply pending migrations
npm run db:check          # verify connectivity
# repo root (PowerShell)
.\tests\run-sql-tests.ps1 -Fresh   # rebuild + verify all SQL checks
```

Authoring rules and recovery: [`../database/migrations.md`](../database/migrations.md).
Backup policy and restore drills: [`disaster-recovery.md`](disaster-recovery.md).

## Health and observability

Signals detail: [`monitoring.md`](monitoring.md).

- `GET /health` — liveness (process is up, no DB access).
- `GET /health/db` — readiness; `503` unless MySQL answers.
- `GET /metrics` — Prometheus scrape (optional `METRICS_TOKEN`).
- Every response carries `X-Request-Id`; errors use
  `{status:"error", code, message}` with the id for correlation.

## Incidents (basics)

1. Confirm scope: `curl /health/db` — database vs app vs downstream.
2. Check logs for the request id; 5xx spike right after a deploy → roll back.
3. Mitigate: restart the container; roll back the last deploy if the spike
   started with it.
4. Follow up: add/extend the regression test before closing the incident.
