# CI/CD Pipeline

Every gate runs in [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml);
nothing else publishes anything. Deploying is a **manual, reviewed step** — the
workflow never pushes to staging or production on its own.

## 1. Triggers

```yaml
on:
  pull_request:              # every PR
  push:
    branches: [main]         # re-verify main after merge
```

`concurrency` cancels superseded runs per ref. Backend integration tests get a
real `mysql:8.0` service + `ticket_booking_test` database; unit tests need no
services at all. The SQL job gets its own `mysql:8.0` service and the manifest
job needs no cluster — `kubeconform` validates against published schemas.

## 2. Jobs

| Job | Runs | Fails when |
|-----|------|-----------|
| `backend` | `npm ci`, `lint`, `format:check`, `typecheck`, `npm audit --audit-level=high`, `npm test` (unit + integration on MySQL), `test:coverage` | lint/format/type/audit/test error or unit coverage below floor |
| `frontend` | `npm ci`, `lint`, `format:check`, `typecheck`, `npm audit --audit-level=high`, `test:coverage`, `build` | any gate fails or coverage below floor |
| `sql` | `npm ci` not needed — installs the `mysql` client, recreates the DB from `schema.sql`, then `tests/run-sql-tests.ps1 -Fresh` | any `ERROR <code>` in a `tests/sql/` script |
| `manifests` | `kubectl kustomize infrastructure/kubernetes` piped into `kubeconform -strict` (Kubernetes 1.29 schemas) | a rendered object fails schema validation |
| `docker` | builds `./backend` + `./frontend` images (pushes to GHCR on `main`) | any image fails to build |

`docker` runs only after `backend`, `frontend`, `sql` and `manifests` are green,
so a broken schema or manifest cannot publish an image.

## 3. Gates and floors

| Gate | Floor |
|------|-------|
| Frontend coverage | `vite.config.ts` thresholds: lines/statements 90, functions/branches 75 |
| Backend unit coverage | `scripts/check-coverage.js` floors: lines 55, branches 80, functions 30 |
| Backend suite | unit hermetic (no DB) + integration on MySQL 8 |
| SQL suite | every `tests/sql/` file runs clean against a database rebuilt from `schema.sql` |
| Manifests | every rendered object matches the Kubernetes 1.29 API schema (strict) |
| Dependency audit | `npm audit --audit-level=high` clean in both stacks |
| Reproducibility | `npm ci` from committed `package-lock.json` only |

A new module with no tests pulls the frontend floor down — that is the point:
new code arrives with its tests.

## 4. Reproducing CI locally

```bash
cd backend && npm run verify        # lint + format + typecheck + unit tests
cd ../frontend && npm run verify    # lint + format + typecheck + coverage
.\tests\run-sql-tests.ps1 -Fresh    # SQL checks against a rebuilt DB
kubectl kustomize infrastructure/kubernetes | kubeconform -strict -summary
docker compose up --build           # whole-stack parity check
```

If these pass locally, the pipeline passes. Per-suite detail:
[`../development/testing.md`](../development/testing.md).

