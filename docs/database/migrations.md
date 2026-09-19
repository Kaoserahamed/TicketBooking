# Database Migrations

How a schema change is authored, reviewed, applied and verified. The schema
is in [`schema.md`](schema.md); deploy sequence in
[`../deployment/production.md`](../deployment/production.md).

## 1. How the pieces fit together

| Piece        | Path                                                       | Role                                               |
| ------------ | ---------------------------------------------------------- | -------------------------------------------------- |
| Schema truth | `infrastructure/database/schema.sql`                       | full shape for a fresh DB                          |
| Migrations   | `infrastructure/database/migrations/*.sql`                 | forward-only deltas, filename order                |
| Runner       | `backend/scripts/run-migrations.js` (`npm run db:migrate`) | applies pending files, records `schema_migrations` |
| K8s init     | `infrastructure/kubernetes/mysql-initdb-configmap.yaml`    | same schema for first boot                         |
| SQL checks   | `tests/sql/*.sql` + `tests/run-sql-tests.ps1`              | repeatable verification                            |

## 2. Everyday commands

```bash
cd backend
npm run db:migrate                 # apply pending migrations
npm run db:check                   # verify MySQL is reachable
# PowerShell (repo root)
.\tests\run-sql-tests.ps1 -Fresh   # rebuild from schema.sql, then run all checks
```

## 3. Authoring a migration

1. Change `schema.sql` first (fresh-DB truth).
2. Add `infrastructure/database/migrations/NNN-slug.sql`, idempotent
   (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN` guarded).
3. Keep one logical change per file; never edit a file already applied to a
   shared DB — add a new one.
4. Add the migration + model change + test in the same PR; update
   [`schema.md`](schema.md) and `CHANGELOG.md` when the shape changes.

## 4. Applying per environment

| Environment | Procedure                                                             |
| ----------- | --------------------------------------------------------------------- |
| Local       | `docker compose up -d` then `npm run db:migrate` from `backend/`      |
| Staging     | back up first, then `npm run db:migrate` from the release image       |
| Production  | back up, review (`--dry-run` diff), apply, verify — see production.md |

## 5. Verifying and recovering

- `npm run db:check` must pass after a deploy; `.\tests\run-sql-tests.ps1`
  must exit 0.
- Migration failed halfway: re-read the error, fix the file (if not yet
  shared) and retry — the runner skips already-applied files.
- App broken after apply: roll the **image** back
  ([`../deployment/rollback.md`](../deployment/rollback.md)); never hand-edit
  `schema_migrations`.

## 6. Backups

Migrations are not backups. Take a dump first; restore path is in
[`../operations/disaster-recovery.md`](../operations/disaster-recovery.md).
