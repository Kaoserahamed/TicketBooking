# Security Policy

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 0.1.x   | ✅        |
| < 0.1   | ❌        |

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability, please report it responsibly.

### How to Report

**Do NOT open a public GitHub issue for security vulnerabilities.**

Instead, send an email to: **security@kaoserahamed.com** (or the maintainer's designated security email)

Include:

- Description of the vulnerability
- Steps to reproduce (if possible)
- Potential impact
- Any suggested fixes (optional)

### What to Expect

| Step               | Timeline                           |
| ------------------ | ---------------------------------- |
| Acknowledgment     | Within 2 business days             |
| Initial assessment | Within 5 business days             |
| Status update      | Every 7 days                       |
| Resolution target  | Within 30 days for critical issues |

### Disclosure Policy

- **Private reporting**: Security issues are handled privately until a fix is available
- **Coordinated disclosure**: We will work with you on a disclosure timeline
- **Public disclosure**: After a fix is released, we may publish a security advisory

## Security Features

### Authentication

- **JWT access tokens**: Short-lived (15 minutes default), sent as `Authorization: Bearer`
- **Refresh tokens**: 7-day lifetime, stored as SHA-256 hash only (never raw token)
- **Token rotation**: Refresh tokens are rotated on each use; old tokens are revoked
- **Reuse detection**: Reuse of a revoked refresh token is detected and logged
- **Cookie security**: Refresh cookie is httpOnly, SameSite=strict

### Authorization

- **Role-based access control (RBAC)**: Roles checked server-side on every request
- **Ownership enforcement**: Users can only access their own bookings/data
- **Admin routes**: Protected by role guards; frontend guards are UX only

### Password Security

- **bcrypt hashing**: Passwords hashed with configurable cost factor (default 10)
- **No enumeration**: Login, forgot-password, and reset endpoints return identical responses regardless of whether the account exists

### Input Validation

- **Zod schemas**: All API inputs validated with Zod
- **Parameterized SQL**: All database queries use bound parameters (no string concatenation)
- **Content-Type enforcement**: JSON only, 1MB limit

### Rate Limiting

- **Auth endpoints**: Rate limited per IP (configurable window and max requests)
- **Redis-backed**: Optional shared rate limiting across instances

### Security Headers

- **Helmet**: Sets various HTTP headers for security
- **CSP**: Content Security Policy headers configured
- **X-Powered-By**: Disabled

### Secrets Management

See [docs/security/secrets-management.md](docs/security/secrets-management.md) for details.

- Production secrets come from environment or secrets manager
- No defaults in production — placeholder secrets are rejected
- `.env` files are git-ignored; only `.env.example` templates are tracked

### Dependency Security

- **npm audit**: Run with `--audit-level=high` in CI
- **Dependabot**: Weekly dependency update PRs
- **Vulnerability response**: Advisories that cannot be closed by a bump are tracked in the threat model

### Logging & Monitoring

- **Structured logging**: Pino JSON logs with credential redaction
- **Metrics**: Prometheus endpoint at `/metrics` (optional token gate)
- **Request tracing**: `X-Request-Id` on every response

## Known Security Gaps

See [docs/security/threat-model.md](docs/security/threat-model.md) for the current threat model and known gaps:

| Gap                                     | Status                                         |
| --------------------------------------- | ---------------------------------------------- |
| CORS currently open (`app.use(cors())`) | TODO: restrict origins per environment         |
| No upload sink yet (posters are URLs)   | Allow-list + sniff when uploads land           |
| `/metrics` unauthenticated by default   | Set `METRICS_TOKEN` or network-gate if exposed |

## Security Releases

Security fixes follow the standard release process with priority handling:

1. Fix developed on a private branch
2. Tested and verified
3. Released as a PATCH version
4. Security advisory published (if warranted)
5. CHANGELOG updated with `security` category

## Acknowledgments

We appreciate responsible disclosure and will credit reporters (with permission) in security advisories.

## Contact

For security concerns, contact the maintainers through the private reporting channel above. For general questions, open a GitHub issue.
