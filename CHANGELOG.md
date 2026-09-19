# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

### Added
- `backend/tests/unit/manifest-hardening.test.js` — hermetic guard for the
  Kubernetes overlay: resource requests+limits on every container, both probes
  on every workload, no privileged/host access, `imagePullPolicy: Always` on
  `:latest`, placeholder-only secrets, the non-root node-user pin, and MySQL
  persistence.

### Fixed
- `infrastructure/kubernetes/backend.yaml`: the `wait-for-mysql` init
  container now declares `limits` alongside `requests`, so the new guard
  passes against a real quota, and the pod-level `runAsUser`/`runAsGroup`
  pin is documented against `backend/Dockerfile` (`USER node`, UID 1000).

## [0.1.1] - 2026-09-19

### Added
- Throwaway test stack for a fresh clone: `docker-compose.test.yml` (MySQL 8 on
  3307, Redis on 6380) plus `backend/.env.test.example`, so the integration and
  SQL suites run without a pre-existing database account.
- `tests/unit/test-stack.test.js` — hermetic drift guard proving the compose
  file, the env template and the README all describe the same stack.
- CI job `sql`: recreates the schema on a real `mysql:8.0` service and runs every
  `tests/sql/` script.
- CI job `manifests`: renders `infrastructure/kubernetes` with
  `kubectl kustomize` and validates all 13 objects with `kubeconform -strict`
  against the Kubernetes 1.29 schemas.

### Changed
- The `docker` job now waits for `backend`, `frontend`, `sql` and `manifests`, so
  a broken schema or manifest can no longer publish an image.
- README, `docs/deployment/ci-cd.md`, `docs/operations/runbook.md` and
  `docs/development/testing.md` document the local test stack and the new gates.

### Fixed
- `docs/development/testing.md`: restored a sentence that had been split in half,
  leaving its tail orphaned at the end of the file.

---

## [0.1.0] - 2026-09-19

### Added
- **Backend (Express.js + Node.js)**
  - Authentication system with JWT access + rotating refresh tokens
  - User registration, login, logout, refresh, and password recovery flows
  - Role-based access control (USER, ADMIN, EVENT_MANAGER, VENUE_MANAGER, SUPPORT)
  - Events, venues, shows, and seat management APIs
  - Booking system with atomic seat reservation (double-booking prevention)
  - Payment integration scaffolding (Stripe)
  - Health check endpoints (`/health`, `/health/db`)
  - Prometheus metrics endpoint (`/metrics`)
  - Structured logging with Pino
  - Optional Sentry error tracking

- **Frontend (React + TypeScript + Vite)**
  - SPA with React Router
  - Auth pages (login, register, password reset, email verification)
  - Event browsing and venue discovery
  - Seat selection and booking flow
  - Payment page integration
  - User profile management
  - Admin pages for event/venue/show management
  - Zustand state management for auth
  - Axios client with Bearer token + refresh interceptor

- **Database (MySQL 8)**
  - Full schema with 12 tables
  - Users, venues, seats, events, shows, show_seats
  - Bookings, booking_items, payments, tickets
  - Refresh token rotation store
  - User action tokens (email verification, password reset)
  - Forward-only migration system

- **Infrastructure**
  - Docker Compose for local development (MySQL, backend, frontend/nginx)
  - Kubernetes manifests (backend, frontend, MySQL, Redis, HPA, ingress)
  - Database migrations in `infrastructure/database/migrations/`
  - SQL test suite validating seed data, auth, booking flow, concurrency

- **Testing**
  - Backend: hermetic unit tests (no DB), integration tests (MySQL)
  - Frontend: Vitest + Testing Library with enforced coverage thresholds
  - SQL validation scripts

- **Documentation**
  - System architecture documentation
  - API design and authentication guides
  - Database schema and migration procedures
  - Deployment, CI/CD, and rollback guides
  - Operations runbook, monitoring, and disaster recovery
  - Security threat model and secrets management
  - Architecture Decision Records (ADRs)

### Changed
- N/A

### Fixed
- N/A

### Security
- bcrypt password hashing (cost factor configurable via `BCRYPT_ROUNDS`)
- JWT access tokens with 15-minute expiry
- Rotating refresh tokens with SHA-256 hash storage
- Refresh token reuse detection
- httpOnly, SameSite=strict refresh cookie
- Helmet security headers
- CORS configured (TODO: restrict origins per environment)
- Auth rate limiting on `/api/v1/auth/*`
- Uniform 401 responses (no user enumeration)
- Parameterized SQL queries (no string concatenation)

---

## Release Process

1. Ensure CI is green on `main`
2. Update this CHANGELOG under `Unreleased` → new version section
3. Cut an annotated tag: `git tag -a vX.Y.Z -m "TicketBooking vX.Y.Z"`
4. Push `main` and the tag: `git push origin main && git push origin vX.Y.Z`
5. CI rebuilds and publishes container images to GHCR

[0.1.1]: https://github.com/Kaoserahamed/TicketBooking/releases/tag/v0.1.1
[0.1.0]: https://github.com/Kaoserahamed/TicketBooking/releases/tag/v0.1.0
