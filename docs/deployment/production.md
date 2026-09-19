# Production Deployment

How to build, deploy, and operate TicketBooking per environment. Release cut
(tag -> CI -> GHCR): [`ci-cd.md`](ci-cd.md). Bad release: [`rollback.md`](rollback.md).

## Environments

| Environment | Backend | Frontend | Database | Who deploys |
| ----------- | ------- | -------- | -------- | ----------- |
| Local dev | `npm run dev` (:4000) | `npm run dev` (:5173) | `docker compose up -d mysql` or local MySQL 8 | Developer |
| Compose | `docker compose up --build` | same (nginx :8080) | compose `mysql` (schema auto-loaded) | Developer |
| Staging | container from GHCR tag | container or `npm run build` + static host | MySQL 8, real secrets from env | Manual, reviewed |
| Production | container from GHCR tag (`latest` or pinned) | container or static build behind reverse proxy | MySQL 8 + read replica, secrets manager | Manual, reviewed |

Deployment is **manual and reviewed** at every non-local stage. CI never pushes
to a runtime environment on its own.

## Container images

| Dockerfile | What it builds | Where CI runs it |
| ---------- | -------------- | ---------------- |
| `backend/Dockerfile` | API from `package-lock.json` (`npm ci`), non-root `node` | `docker` job |
| `frontend/Dockerfile` | Vite build then nginx static + `/api` proxy | `docker` job |

Run a released image locally:

```bash
docker compose up --build
curl -fsS http://localhost:4000/health
curl -fsS http://localhost:8080/
```

## Pod hardening

The overlay is schema-validated in CI (`kubeconform -strict`), and the
properties below are asserted by
`backend/tests/unit/manifest-hardening.test.js` — a manifest edit that drops one
of them fails the build instead of reaching a cluster:

- Every container declares `resources.requests` **and** `resources.limits`
  (the MySQL wait init container included).
- Every workload declares both a `readinessProbe` and a `livenessProbe`.
- No pod asks for `privileged`, `hostNetwork`, `hostPID`, `hostIPC` or a
  `hostPath` volume.
- The mutable `:latest` tag the pipeline publishes is always paired with
  `imagePullPolicy: Always`, so a node never serves a stale layer.
- `backend-secrets.yaml` holds `CHANGE-ME-*` placeholders only; real values come
  from `kubectl create secret` or a secrets manager.
- The API pod pins `runAsNonRoot: true` with `runAsUser`/`runAsGroup` `1000` to
  match `backend/Dockerfile` (`USER node`), and drops all Linux capabilities.
- MySQL keeps its data in a `volumeClaimTemplates` claim, never in the container
  filesystem.

## Reverse proxy

`frontend/nginx.conf` serves the static build and proxies `/api` to the
backend (same origin, so the httpOnly refresh cookie behaves like dev). In
production put TLS in front (nginx / ALB / Front Door) and never expose
MySQL or `:4000` directly to the internet.

## Database migrations

Migrations are forward-only in `infrastructure/database/migrations/`, applied
by `npm run db:migrate` from `backend/`. Full workflow:
[`../database/migrations.md`](../database/migrations.md).

## Secrets management

- **Never commit real secrets.** `.env` is ignored; only `.env.example`
  templates with placeholders are tracked.
- Production secrets (`DB_PASSWORD`, `JWT_SECRET`, `JWT_REFRESH_SECRET`,
  `STRIPE_*`, `SENTRY_DSN`) come from the environment or a secrets manager.
- If a secret is suspected leaked, rotate it and follow
  [`../security/secrets-management.md`](../security/secrets-management.md).

