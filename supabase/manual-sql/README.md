# Manual SQL archive

These `.sql` files were applied **by hand in the Supabase SQL editor**, not through
`supabase db push`. They were originally dropped in `supabase/migrations/` but their
filenames don't follow the required `<14-digit-timestamp>_name.sql` format, so the CLI
never tracked them in `supabase_migrations.schema_migrations`. They're archived here so
the migrations folder only contains real, trackable migrations.

**Do not move these back into `supabase/migrations/`.** They are a historical record of
schema changes that are already live in production.

---

## Migration drift — what happened and how to fix it

`supabase db push` currently fails for two separate reasons:

1. **DB password mismatch** — the CLI can't authenticate to the database.
   Fix: Supabase Dashboard → Project Settings → Database → *Reset database password*,
   then `supabase link --project-ref kgndpwzqohepotahnfeo` with the new password.
   (Only a project owner can do this — it is not something automation should change.)

2. **History table is far behind** — production's `schema_migrations` table only records
   migrations up to ~`20260116`, but the live schema actually contains everything through
   June (newsletters, newsletter_series, all the cron migrations, etc.) because they were
   applied manually. If you run `db push` as-is, the CLI will try to re-run ~130 migrations
   that are already applied and fail with "already exists" errors.

### One-time repair (after the password works)

Baseline the history so the CLI knows the existing migrations are already applied:

```bash
# Mark every local migration as already-applied WITHOUT running it
supabase migration list --project-ref kgndpwzqohepotahnfeo   # see local vs remote
# For each local version the remote is missing but which IS already in the DB:
supabase migration repair --status applied <version> --project-ref kgndpwzqohepotahnfeo
```

After baselining, only genuinely-new migrations will run on the next `db push`, and the
manual-dashboard workflow can be retired.

> Tip: going forward, add new schema changes as `supabase/migrations/<timestamp>_name.sql`
> and apply them with `supabase db push` so local and prod never drift again.
