# Disaster Recovery

How TicketBooking is backed up, restored and rehearsed. Scripts: SQL dumps via
`mysqldump`; day-to-day path: [`runbook.md`](runbook.md).

## 1. What exists, and what can be lost

| Asset                                                      | Where                                       | Backed up by                             |
| ---------------------------------------------------------- | ------------------------------------------- | ---------------------------------------- |
| Booking data (all MySQL tables)                            | managed MySQL / compose `mysql-data` volume | `mysqldump` dumps                        |
| Secrets (`JWT_*`, `DB_PASSWORD`, `STRIPE_*`, `SENTRY_DSN`) | environment / secrets manager               | the secrets manager; never a dump        |
| Release images                                             | GHCR (`backend`/`frontend` tags)            | the registry, built from a tagged commit |
| Code and migrations                                        | GitHub                                      | git history                              |

**Targets** (proposals — agree real ones before relying on them):

| Metric                | Target                                                  |
| --------------------- | ------------------------------------------------------- |
| RPO (max data loss)   | 24 h with daily dumps                                   |
| RTO (restore service) | < 2 h from a verified dump, < 30 min for image rollback |

## 2. Backups

```bash
mysqldump -h 127.0.0.1 -u root -p ticket_booking | gzip -9 > backups/tbs_$(date +%Y%m%d_%H%M%S).sql.gz
```

Recommended cadence: daily keep 30 days off-host; weekly keep 12 weeks; always
before every migration or release.

## 3. Restore

1. **Stop writes** (scale API to zero / maintenance mode).
2. **Preserve current state** (`mysqldump` the live DB first).
3. **Restore** into the target (`gunzip < dump | mysql`), or a scratch DB first.
4. **Apply migrations** (`npm run db:migrate`) if the dump predates the release.
5. **Verify**: `/health` 200, `/health/db` 200, log in, hold a seat, confirm
   the newest booking matches the dump timestamp.
6. **Re-enable traffic** and watch logs for new 5xx.

## 4. Scenario playbook

| Scenario                    | Action                                                                             |
| --------------------------- | ---------------------------------------------------------------------------------- |
| Bad release, no data damage | roll the image back (faster): `../deployment/rollback.md`                          |
| Accidental row deletion     | restore dump into **scratch** DB, export affected rows, re-insert                  |
| DB volume lost              | provision new MySQL, restore latest dump, `npm run db:migrate`, restart API        |
| Secret leaked/lost          | rotate per `../security/secrets-management.md` (new JWT secrets sign everyone out) |

## 5. Rehearsal

A backup never restored is a hypothesis. Rehearse **quarterly**:

```bash
docker run --rm -d --name dr-drill -e MYSQL_ROOT_PASSWORD=drill -p 55432:3306 mysql:8.0
gunzip -c backups/tbs_<ts>.sql.gz | mysql -h 127.0.0.1 -P 55432 -u root -pdrill ticket_booking
mysql -h 127.0.0.1 -P 55432 -u root -pdrill -e "SELECT count(*) FROM bookings; SELECT count(*) FROM show_seats;"
docker rm -f dr-drill
```

Keep: dump timestamp, wall-clock restore time (measured RTO), row counts, and
any step that did not match this document.

## 6. Checklist

- [ ] Off-host daily dumps running, with failure alerting
- [ ] Retention agreed and enforced by storage lifecycle
- [ ] Secrets in a manager, not in dumps or the repo
- [ ] Latest dump restored into scratch within the last quarter
- [ ] RTO measured; runbook updated with deviations
