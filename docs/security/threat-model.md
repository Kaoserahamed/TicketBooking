# Threat Model

What TicketBooking protects, where trust changes, and which threats are
mitigated, accepted or still open. Policy: [`../../SECURITY.md`](../../SECURITY.md)
once added; secrets: [`secrets-management.md`](secrets-management.md).

## 1. Scope and assets

In scope: Express API, React SPA, MySQL database, CI/CD pipeline. Out of scope:
OS, managed DB internals, user devices.

| Asset                               | Why it matters                         | Where it lives                                          |
| ----------------------------------- | -------------------------------------- | ------------------------------------------------------- |
| Booking/seat data                   | oversell = core failure; money + trust | MySQL, guarded by atomic writes                         |
| Credentials                         | account takeover                       | bcrypt hashes in `users.password_hash`; JWTs in transit |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | forge any session                      | environment / secrets manager                           |
| `STRIPE_*`                          | billable payments                      | environment / secrets manager                           |
| Release images                      | supply chain                           | GHCR tags from `main`                                   |

## 2. Trust boundaries

```text
[ Browser ] --untrusted network--> [ Reverse proxy / TLS ]
                                         |
                                         v
                                   [ Express API ] <-- trusts: proxy headers, CORS allow-list
                                         |
                         +---------------+---------------+
                         v                               v
                    [ MySQL ]                        [ Redis (optional) ]
                         |
                         v
                  [ GHCR / CI ] <-- trusts: GitHub Actions, repo secrets
```

1. **Browser -> API.** All input untrusted: Zod validates shape,
   `authenticate` decides identity, `authorize` decides visibility.
2. **API -> database.** API is the only writer. Ownership is a **service-layer**
   control — a query forgetting `user_id` would leak.
3. **CI -> registry.** Only `main` pushes publish images, and only after
   lint/test/build gates pass.

## 3. Threats and mitigations

| #   | Threat                      | Mitigation                                                          | Status                        |
| --- | --------------------------- | ------------------------------------------------------------------- | ----------------------------- |
| T1  | Read another user's booking | ownership check in `booking.service` (`403` unless owner/admin)     | mitigated                     |
| T2  | Forged token                | JWT verify with per-type secrets + expiry; refresh hash lookup      | mitigated                     |
| T3  | Password brute force        | bcrypt, uniform `401` (no enumeration), auth rate limit             | mitigated                     |
| T4  | Stolen refresh token reused | rotation + revocation + reuse detection (`replaced_by_hash`)        | mitigated                     |
| T5  | Privilege escalation        | role read per request from `users.role`; writes gated inline        | mitigated                     |
| T6  | Oversell / double booking   | atomic guarded `UPDATE` + unique `(show_id,seat_id)` + tx           | mitigated                     |
| T7  | SQL injection               | `pool.execute` bound params everywhere; no string SQL               | mitigated                     |
| T8  | XSS via stored fields       | React escaping + helmet CSP-adjacent headers; poster URLs validated | partly (no upload sink today) |

## 4. Known gaps

| ID  | Gap                                          | Fix                                            |
| --- | -------------------------------------------- | ---------------------------------------------- |
| G1  | CORS currently open (`app.use(cors())` TODO) | restrict origins per environment               |
| G2  | No upload sink yet (posters are URLs)        | allow-list + sniff when uploads land           |
| G3  | `/metrics` unauthenticated by default        | set `METRICS_TOKEN` or network-gate if exposed |

G1 is the most likely to surprise a reader because `production.md` assumes a
same-origin proxy. The code comment in `app.js` is the current truth.

## 5. Review cadence

Re-read when: new endpoint/role, auth/crypto change, new dependency, topology
change, or security fix. Record decisions as an ADR in
[`../architecture/decisions/`](../architecture/decisions/).
