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
services at all.

## 2. Jobs

| Job | Runs | Fails when |
|-----|------|-----------|
| `backend` | `npm ci`, `lint`, `format:check`, `typecheck`, `npm audit --audit-level=high`, `npm test` (unit + integration on MySQL) | lint/format/type/audit/test error |
| `frontend` | `npm ci`, `lint`, `format:check`, `typecheck`, `npm audit --audit-level=high`, `test:coverage`, `build` | any gate fails or coverage below floor |
| `docker` | builds `./backend` + `./frontend` images (pushes to GHCR on `main`) | any image fails to build |

## 3. Gates and floors

| Gate | Floor |
|------|-------|
| Frontend coverage | `vite.config.ts` thresholds: lines/statements 90, functions/branches 75 |
| Backend suite | unit hermetic (no DB) + integration on MySQL 8 |
| Dependency audit | `npm audit --audit-level=high` clean in both stacks |
| Reproducibility | `npm ci` from committed `package-lock.json` only |

A new module with no tests pulls the frontend floor down — that is the point:
new code arrives with its tests.

## 4. Reproducing CI locally

```bash
cd backend && npm run verify        # lint + format + typecheck + unit tests
cd ../frontend && npm run verify    # lint + format + typecheck + coverage
.\tests\run-sql-tests.ps1 -Fresh    # SQL checks against a rebuilt DB
docker compose up --build           # whole-stack parity check
```

If these pass locally, the pipeline passes. Per-suite detail:
[`../development/testing.md`](../development/testing.md).

