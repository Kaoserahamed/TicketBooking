# Rollback

What to do when a release is live and wrong. Rule: **application code rolls
back cleanly, the database does not.** Images are immutable and tagged;
migrations are forward-only.

## 1. Decide first

| Symptom | Action |
|---------|--------|
| Elevated 5xx / new error envelope spike | roll the image back |
| Wrong behaviour, data intact | roll image back, then fix forward |
| Migration applied, old code cannot read new schema | **roll forward** — do not downgrade |
| Data corrupted by the bad release | stop writes, restore last verified dump |

Ask: **did this version change the schema?** Compare
`git diff v<prev>..v<cur> -- infrastructure/database/migrations`. If a column
was dropped/renamed, the old image cannot read the new schema — roll forward
with a PATCH instead.

## 2. Roll the application image back

```bash
# 1. Confirm the previous image still starts
docker pull ghcr.io/<org>/ticketbooking-backend:<prev>
docker run --rm -p 4000:4000 --env-file .env ghcr.io/<org>/ticketbooking-backend:<prev>
curl -fsS http://localhost:4000/health/db   # expect 200

# 2. Redeploy the previous tag (compose or orchestrator), keep the bad
#    container for logs.
# 3. Verify
curl -fsS http://localhost:4000/health
curl -fsS http://localhost:4000/metrics | head
```

The frontend is stateless: redeploy the previous build the same way.

## 3. Schema: forward-only

- Do **not** hand-revert migrations in production. A partially reverted schema
  is worse than a reverted image.
- Never hand-edit `schema_migrations`; the runner and reality would disagree.
- If the bad release added a column the old code ignores, roll back and fix
  forward — the extra column is harmless.
- If it removed/renamed something the old code needs, restore the shape with a
  new migration and release it as PATCH.

## 4. After the rollback

1. Confirm `/health/db` is 200 and a known-good flow (browse -> hold) works.
2. Freeze deploys until the cause is understood — `git log` between tags plus
   changelog is the change set.
3. Add the regression test that fails without the fix and land it before
   re-releasing.
4. Cut a PATCH release and follow [`production.md`](production.md) again —
   do not re-tag the same version.

## 5. Rollback checklist

- [ ] Previous image tag identified and verified locally
- [ ] `/health/db` returns 200 on the rolled-back version
- [ ] Schema compatibility confirmed before/instead of rollback
- [ ] No manual `schema_migrations` edits
- [ ] Frontend redeployed if the API contract changed
- [ ] Regression test added and green
- [ ] PATCH release cut, tagged, deployed

