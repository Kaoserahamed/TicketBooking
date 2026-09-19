# ADR 0004 — Short-lived access tokens + rotating refresh tokens

- **Date:** 2026-09-19
- **Status:** Accepted

## Context

Browsers keep a session for days, so tokens live partly in JavaScript
(`localStorage` access token) and partly in an httpOnly cookie (refresh).
A single never-expiring token would be a standing credential-theft risk;
forcing full re-login every 15 minutes would be unusable at checkout.

## Decision

- **Access token:** 15-minute JWT (`JWT_SECRET`), sent as
  `Authorization: Bearer ...` on every call.
- **Refresh token:** 7-day JWT (`JWT_REFRESH_SECRET`), usable only at
  `POST /api/v1/auth/refresh`. Only its SHA-256 hash is stored in
  `refresh_tokens`; rotation revokes the old row and records the replacement.
- **Recovery:** single-use opaque tokens via `/forgot-password` then
  `/reset-password`; the response never reveals whether an account exists.

## Consequences

- A stolen access token is useful for minutes, not days.
- The frontend interceptor can silently refresh on 401 without user action.
- Refresh-token reuse is detectable server-side (revoked/replaced rows), unlike
  stateless JWT pairs.
