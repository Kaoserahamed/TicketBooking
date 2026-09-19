# Contributing to Ticket Booking System

Thank you for your interest in contributing! This document provides guidelines and steps for contributing to the Ticket Booking System.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [How to Contribute](#how-to-contribute)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Testing Requirements](#testing-requirements)
- [Documentation](#documentation)
- [Release Process](#release-process)

## Code of Conduct

This project adheres to a code of conduct. By participating, you are expected to uphold this code. Please be respectful and constructive in all interactions.

## Getting Started

### Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 20+ | API, SPA, vitest |
| npm | bundled | Package management |
| MySQL | 8+ or Docker | Runtime + integration tests |
| Docker | any recent | MySQL container, image builds |
| Redis | optional | Shared rate limiting / cache |

### Quick Setup

```bash
# Clone the repository
git clone https://github.com/Kaoserahamed/TicketBooking.git

## How to Contribute

### Finding Issues

- Look for issues labeled `good first issue` for beginner-friendly tasks
- Check the [documentation](docs/) for areas that need improvement
- Review the [architecture decisions](docs/architecture/decisions/) for context

### Branching

We follow a feature-branch workflow:

```bash
# Start from up-to-date main
git switch main && git pull --ff-only

# Create a feature branch
git switch -c feat/<short-slug>

# Or for fixes
git switch -c fix/<short-slug>
```

Branch naming conventions:
- `feat/<slug>` — new feature
- `fix/<slug>` — bug fix
- `docs/<slug>` — documentation only
- `chore/<slug>` — maintenance tasks

## Pull Request Process

### Before Submitting

1. Ensure your branch is up to date with `main`
2. Run verification on both stacks:

```bash
# Backend
cd backend && npm run verify

# Frontend
cd frontend && npm run verify

# SQL tests (PowerShell)
.\tests\run-sql-tests.ps1 -Fresh
```

3. Update `CHANGELOG.md` under `Unreleased` if your change is user-facing

### PR Template

```markdown
## What
<!-- Brief description of the change -->

## Why
<!-- Motivation and context -->

## Type of Change
- [ ] Bug fix (non-breaking change fixing an issue)
- [ ] New feature (non-breaking change adding functionality)
- [ ] Breaking change (fix or feature that changes existing functionality)
- [ ] Documentation update

## Verification
- [ ] `npm run verify` passes (backend)

## Coding Standards

### Backend (Express.js + Node.js)

- **Architecture**: Follow the layering in [system-architecture.md](docs/architecture/system-architecture.md)
  - Routes → Controllers → Services → Repositories
  - No business logic in routes or controllers
  - No HTTP concerns in services or repositories
- **Error handling**: Use the error classes in `utils/errors.js`
- **Validation**: Use Zod schemas in `validators/`
- **Database**: Always use parameterized queries (`pool.execute` with bound params)
- **Logging**: Use the pino logger; never log secrets or credentials

### Frontend (React + TypeScript + Vite)

- **TypeScript**: Strict mode enabled; prefer types over `any`
- **Components**: Presentational components in `components/`, pages in `pages/`

## Testing Requirements

### Backend

```bash
cd backend
npm run test:unit        # hermetic unit tests (no DB)
npm run test:integration # requires MySQL
npm test                 # both
```

Unit tests must be hermetic — no external services. Integration tests target a real MySQL.

### Frontend

```bash

## Documentation

### When to Update Documentation

- **New feature**: Update relevant docs in `docs/`
- **API change**: Update [api/authentication.md](docs/api/authentication.md) and [04-api-design.md](docs/04-api-design.md)
- **Schema change**: Update [database/schema.md](docs/database/schema.md) and add migration
- **Architecture decision**: Add an ADR in [architecture/decisions/](docs/architecture/decisions/)
- **Security change**: Update [security/threat-model.md](docs/security/threat-model.md)

See the [documentation index](docs/README.md) for the full structure.

## Release Process

Releases are cut from `main` only, when CI is green:

```bash
# 1. Update CHANGELOG.md
# 2. Commit the changelog update
git add CHANGELOG.md
git commit -m "chore(release): prepare vX.Y.Z"

# 3. Tag the release
git tag -a vX.Y.Z -m "TicketBooking vX.Y.Z"

# 4. Push
git push origin main
git push origin vX.Y.Z
```

CI will rebuild and publish container images on tag push.

See [docs/deployment/ci-cd.md](docs/deployment/ci-cd.md) for the full pipeline.

## Questions?

1. Check existing documentation in [docs/](docs/)
2. Search open and closed issues
3. Open a new issue with the `question` label

Thank you for contributing to Ticket Booking System!
cd frontend
npm run test:run         # single run (CI-style)
npm run test:coverage    # with enforced thresholds
```

Coverage thresholds (enforced in CI):
- Lines/Statements: 90%
- Functions/Branches: 75%

### SQL Tests

```bash
.\tests\run-sql-tests.ps1 -Fresh   # PowerShell
```

Validates seed data, auth queries, booking flow, and concurrency guards.
- **State**: Zustand for global state; React Query for server state
- **API calls**: Only through `api/` modules — the single fetch layer
- **Testing**: Use Testing Library; tests in `src/test/`

### General

- **Linting**: ESLint 9 flat config
- **Formatting**: Prettier
- **Code style**: Follow existing patterns; be consistent
- [ ] `npm run verify` passes (frontend)
- [ ] SQL tests pass (if schema changed)
- [ ] CHANGELOG.md updated

## Checklist
- [ ] Branch up to date with main
- [ ] Lint, format, typecheck pass (both stacks)
- [ ] Tests pass with coverage floors met
- [ ] New behavior has tests that fail without the change
- [ ] No secrets, no build artifacts, no large binaries
- [ ] Schema change? Migration included, reviewed, forward-only
```

### Code Review Checklist

Reviewers will check:
- [ ] Code quality and adherence to project conventions
- [ ] Test coverage for new functionality
- [ ] Security implications (auth, data access, secrets)
- [ ] Documentation updates where needed
- [ ] Backward compatibility considerations
- `hotfix/<slug>` — production hotfix

See [docs/development/git-workflow.md](docs/development/git-workflow.md) for comprehensive rules.

### Commit Messages

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<optional body explaining why>
```

Allowed types: `feat`, `fix`, `test`, `ci`, `docs`, `chore`, `refactor`, `perf`, `sec`

Examples:
```bash
git commit -m "feat(booking): add idempotency key support"
git commit -m "fix(auth): correct refresh token rotation"
git commit -m "test(bookings): add concurrency test"
git commit -m "docs(api): document authentication flows"
```

Rules:
1. **One logical change per commit** — never mix formatting/refactor/behavior
2. **Every behavior change ships with a test** that fails without it
3. **Never commit secrets or artifacts** — `.env`, `dist/`, `coverage/`, `node_modules/` are ignored
cd TicketBooking

# Install dependencies
cd backend && npm ci
cd ../frontend && npm ci

# Configure environment
Copy-Item .env.example .env   # PowerShell
# cp .env.example .env        # bash

# Start database (optional)
docker compose up -d mysql

# Run migrations
cd backend && npm run db:migrate

# Start development servers
cd backend && npm run dev    # API on :4000
cd frontend && npm run dev   # SPA on :5173
```

For detailed setup, see [docs/development/setup.md](docs/development/setup.md).