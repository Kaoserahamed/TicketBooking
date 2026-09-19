# Monitoring and Observability

What TicketBooking exposes, how to read it, and what is worth alerting on.
Procedures live in [`runbook.md`](runbook.md).

## 1. Health endpoints

| Endpoint | Kind | Returns | Use |
|----------|------|---------|-----|
| `GET /health` | liveness | service, env, uptime | compose `HEALTHCHECK`, uptime probe |
| `GET /health/db` | readiness | MySQL `SELECT 1`, version, tables; `503` when down | remove/re-add instance |
| `GET /metrics` | diagnostics | Prometheus exposition (request counts, durations, Node runtime) | scrape + alert |

```bash
curl -fsS http://localhost:4000/health
curl -fsS http://localhost:4000/health/db
curl -fsS http://localhost:4000/metrics | head
```

`GET /metrics` supports an optional bearer token (`METRICS_TOKEN`); without it
the endpoint is still safe to scrape inside a trusted network because labels
use matched route patterns (no raw ids) and bodies carry no PII.

## 2. Logs

`utils/logger.js` (pino) configures one JSON object per line:

| Setting | Behaviour |
|---------|-----------|
| `LOG_LEVEL` | trace/debug/info/warn/error/fatal/silent (silent in `test`) |
| `SERVICE_NAME` | stamped as `service` on every line and metric |
| Redaction | `password/token/secret/authorization/cookie` never reach the transport |

Every response carries `X-Request-Id` (caller-supplied or generated) so a
browser trace correlates with the server line. Probe paths
(`/health`, `/health/db`, `/metrics`) are excluded from request logs.

## 3. What to alert on

Starting points for a small deployment, not measured SLOs:

| Signal | Source | Suggested alert |
|--------|--------|-----------------|
| Readiness failing | `GET /health/db` | `503` twice in 30 s -> page |
| 5xx rate | request logs / proxy | > 1% over 5 min -> page |
| p95 latency | duration histogram | hold > 2 s -> warn |
| Login failures | 401 burst on `/api/v1/auth/login` | burst -> possible stuffing |
| DB connections | MySQL `SHOW PROCESSLIST` | near `DB_CONNECTION_LIMIT` (default 10) -> raise or find leak |
| Container health | compose `HEALTHCHECK` | unhealthy -> restart, then runbook |

## 4. Gaps to be aware of

| Gap | Impact |
|-----|--------|
| Metrics are per-process, in-memory | reset on restart, not aggregated across replicas; use the log sink for history |
| No distributed trace ids yet | correlate via `X-Request-Id` only |
| `/metrics` has no auth by default | restrict at network layer or set `METRICS_TOKEN` if internet-reachable |

