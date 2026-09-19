# Secrets Management

Where every secret comes from, how it stays out of git, how it rotates, and
what to do on leak. Threat context: [`threat-model.md`](threat-model.md).

## 1. Secret inventory

| Name | Used by | Required | If leaked |
|------|---------|----------|-----------|
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | token signing (`utils/token.js`) | yes | forge any session; rotating signs everyone out |
| `DB_PASSWORD` / `MYSQL_*` | API, compose, SQL runner | yes | full read/write to booking data |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | payments (webhook verify) | in prod | billed payments / forged webhooks |
| `SMTP_USER` / `SMTP_PASSWORD` | mailer | when SMTP used | spam via your sender |
| `SENTRY_DSN` | optional error sink | no | noise into error stream |
| `METRICS_TOKEN` | scrape gate | no | metrics visibility only |
| `SEED_PASSWORD` | dev seed accounts | dev/test | dev data only |
| `GITHUB_TOKEN` | CI release job | CI-provided | short-lived publish scope; never echoed |

Non-secrets that look like secrets: `APP_BASE_URL` (public frontend origin)
and CI-only `ci-db-password` in `.github/workflows/ci.yml`.

## 2. Rules

1. **Never commit a real secret.** `.env` is ignored; only `.env.example`
   templates with placeholders are tracked (`env-example.test.js` enforces it).
2. **Templates list every key** so operators see the full surface:
   root [`.env.example`](../../.env.example).
3. **No defaults in production.** Compose dev placeholders are refused when
   `NODE_ENV=production` (`src/config/env.js` throws on missing/placeholder JWT
   secrets).
4. **Enforce strength at startup.** Production requires real JWT secrets —
   a weak/placeholder value fails fast instead of shipping.
5. **Secrets stay out of logs.** Pino redacts `password/token/secret/
   authorization/cookie`; error reports carry route/request id, not payloads.
6. **Rotate on suspicion, not certainty.** A re-login costs less than a leak.

## 3. Local development

```bash
Copy-Item .env.example .env   # PowerShell
# cp .env.example .env        # bash
# generate real values locally (node one-liner), never reuse anywhere real
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

Committed dev conveniences (`dev-only-*-secret-change-me`, `dev-db-password`)
exist only so `docker compose up` works out of the box; they are refused in
production and must never reach staging/prod.

## 4. Production provisioning

Preferred order: secrets manager injected at start-up (cloud manager, Vault,
K8s `Secret`, `--env-file` from a protected path) > compose env file on the
host > never baked into an image, never in git.

## 5. Rotation

| Secret | Procedure | Impact |
|--------|-----------|--------|
| JWT secrets | new value -> secret store -> restart every API process | **all sessions invalidated**, every user logs in again |
| `DB_PASSWORD` | `ALTER USER ... IDENTIFIED BY` -> secret store + connection string -> restart API -> `npm run db:check` | restart; in-flight requests fail |
| `STRIPE_*` | roll in provider dashboard -> update -> restart | none (webhooks verify against new secret) |

Verify after rotation: `/health` 200, `/health/db` 200, log in via UI.

## 6. If a secret leaks

1. **Contain** — rotate first. Do not wait for a post-mortem.
2. **Scope** — `git log -S '<value>' --all`, check whether the repo was public.
3. **Assess** — for DB: review logs for unattributable access; for JWT: treat
   every token as suspect, force re-login.
4. **Clean up** — remove the literal; rotation (not history rewrite) removes
   exposure.
5. **Record** — `fix(sec): ...` entry in the changelog once it exists.

