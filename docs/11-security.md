# 11. Security

## 11.1 Authentication & Authorization

### Tokens

Use:

```text
JWT access token
+
Refresh token
```

- **Access token:** Short-lived (e.g., 15 minutes). Stored in memory.
- **Refresh token:** Long-lived (e.g., 7 days). Stored in an httpOnly, secure, SameSite cookie.

### Roles (RBAC)

```text
USER
ADMIN
EVENT_MANAGER
VENUE_MANAGER
SUPPORT
```

Authorization should be **enforced server-side**. For example, `/admin/events` must not be protected only through frontend route hiding — the backend must verify the user has the `ADMIN` or `EVENT_MANAGER` role.

## 11.2 Security Requirements

Implement:

- HTTPS everywhere
- Secure password hashing (bcrypt / argon2)
- JWT expiration
- Refresh-token rotation
- Role-based access control (RBAC)
- Input validation (e.g., via Joi or Zod)
- SQL injection protection (parameterized queries / prepared statements)
- XSS protection (output encoding, CSP headers)
- CSRF protection where applicable (httpOnly cookies mitigate most CSRF for JWT)
- Rate limiting (see §11.3)
- WAF (see [System Architecture](02-system-architecture.md))
- Security headers (HSTS, X-Frame-Options, X-Content-Type-Options)
- Audit logging
- Secrets management (environment variables / secret manager — never commit secrets)
- Encryption at rest (database encryption / disk encryption)
- Encryption in transit (TLS for all connections)

### Data Never Stored in Plaintext

Never store raw:

```text
Raw card number
CVV
Payment password
```

> Preferably let the payment provider handle sensitive card data (PCI-DSS compliance).
