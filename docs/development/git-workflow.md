# Git Workflow

Branching, commit, review and release conventions. Local checks:
[`testing.md`](testing.md). Pipeline: [`../deployment/ci-cd.md`](../deployment/ci-cd.md).

## 1. Branches

`main` is the only long-lived branch and is always releasable — CI re-verifies
it on every push.

| Branch | Pattern | Purpose |
|--------|---------|---------|
| `main` | — | releasable truth; tags cut from here only |
| Feature | `feat/<short-slug>` | new capability |
| Fix | `fix/<short-slug>` | bug fix |
| Docs/chore | `docs/<slug>`, `chore/<slug>` | non-behavioural changes |
| Hotfix | `hotfix/<slug>` | production fix, merged then tagged as patch |

1. `git switch main && git pull --ff-only`
2. `git switch -c feat/duplicate-seat-guard`
3. Commit in small, reviewable steps (below).
4. Push the branch and open a pull request — never push to `main` directly.

## 2. Commits

Conventional Commits, imperative subject, max 72 chars:

```text
<type>(<scope>): <subject>

<why this change is needed>
```

Allowed types: `feat`, `fix`, `test`, `ci`, `docs`, `chore`, `refactor`,
`perf`, `sec`. Rules:

1. **One logical change per commit.** Never mix formatting/refactor/behaviour.
2. **Every behaviour change ships with a test** that fails without it.
3. **Never commit secrets or artefacts.** `.env`, `dist/`, `coverage/`,
   `node_modules/`, `uploads/*` are ignored — keep it that way.

## 3. Pull requests

Describe what/why, the change type, and paste verification output
(`npm run verify` per stack + `.\tests\run-sql-tests.ps1` when SQL changes).

Reviewer checklist:

- [ ] Branch up to date with `main`
- [ ] `npm run lint`, `format:check`, `typecheck` pass (both stacks)
- [ ] `npm run test:unit` (backend) + `npm run test:coverage` (frontend) pass
- [ ] Coverage floors hold (frontend vitest thresholds)
- [ ] New behaviour has a test that fails without the change
- [ ] `CHANGELOG.md` updated under `Unreleased` (once it exists)
- [ ] No secrets, no build artefacts, no large binaries
- [ ] Schema change? Migration included, reviewed, forward-only

## 4. Dependency updates

Dependabot (`.github/dependabot.yml`) opens weekly grouped PRs per stack.
A dependency PR still has to pass `npm audit --audit-level=high`; an advisory
that cannot be closed by a bump is recorded in
[`../security/threat-model.md`](../security/threat-model.md).

## 5. Releases and hotfixes

Releases cut from `main` only, green CI + dated changelog section:

```bash
git tag -a v0.1.0 -m "TicketBooking v0.1.0"
git push origin main
git push origin v0.1.0
```

The tag re-runs lint/test/build gates; a bad release rolls back per
[`../deployment/rollback.md`](../deployment/rollback.md). Hotfixes follow the
same path on a `hotfix/` branch, merged to `main`, tagged as PATCH.

