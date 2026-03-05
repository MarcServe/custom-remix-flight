# Deploy Supabase Edge Functions

## Apply database migrations (e.g. Notes, new tables)

If you see **"Could not find the table 'public.crm_notes' in the schema cache"** or any missing-table error, the remote database is missing migrations. Push them:

```bash
supabase link --project-ref kgndpwzqohepotahnfeo   # if not already linked
supabase db push
```

Enter your database password if prompted (Dashboard → Project Settings → Database → Database password). After this, the Notes page and other features that use migrated tables will work.

**If you still get "Could not find the table 'public.crm_notes'"** after `db push` (e.g. some migrations were skipped), create the table manually:

1. Open [Supabase Dashboard](https://supabase.com/dashboard/project/kgndpwzqohepotahnfeo) → **SQL Editor**.
2. Paste and run the contents of `supabase/migrations/RUN_ME_create_crm_notes_if_missing.sql` (or the SQL below).
3. Reload the Notes page and try saving again.

**If you get "column newsletter_subscribers.industry does not exist"** when sending a newsletter, add the column:

1. Open [Supabase Dashboard](https://supabase.com/dashboard/project/kgndpwzqohepotahnfeo) → **SQL Editor**.
2. Run: `ALTER TABLE public.newsletter_subscribers ADD COLUMN IF NOT EXISTS industry TEXT;`
3. Try sending the newsletter again.

## Link your project (one-time)

If you see **"Cannot find project ref. Have you run supabase link?"** or an interactive project picker:

1. Link using the project ref from `supabase/config.toml` (`project_id`):
   ```bash
   supabase link --project-ref kgndpwzqohepotahnfeo
   ```
2. Or use your project ref from the Supabase dashboard (Settings → General → Reference ID). If you use a different project (e.g. MarcServe's Project), use that ref instead.

## Deploy send-newsletter (newsletters)

**Preferred:** use the npm script (no placeholder to replace):

```bash
npm run supabase:deploy:send-newsletter
```

Or with the CLI directly (use the ref from `supabase/config.toml` or your dashboard):

```bash
supabase functions deploy send-newsletter --project-ref kgndpwzqohepotahnfeo
```

After deploying, send again from the Newsletters page. If you still see an error, the toast will now show the **actual error message** from the edge function (e.g. "No active subscribers found", API errors).

## Newsletter cron (scheduled + “next batch after 24h”)

The cron that runs every 15 minutes to send scheduled newsletters and **continue batch sends** (e.g. after the Gmail daily cap) must call the edge function with a valid service role key. Otherwise the request returns 401 and no emails are sent the next day.

### One-time: store cron credentials in Vault

1. Open [Supabase Dashboard](https://supabase.com/dashboard/project/kgndpwzqohepotahnfeo) → **SQL Editor**.
2. Run the following **once**, replacing `YOUR_SERVICE_ROLE_KEY` with your real key (Dashboard → Project Settings → API → `service_role` secret):

```sql
-- Project URL (no trailing slash)
SELECT vault.create_secret('https://kgndpwzqohepotahnfeo.supabase.co', 'cron_project_url');
-- Service role key so pg_cron can authenticate to Edge Functions
SELECT vault.create_secret('YOUR_SERVICE_ROLE_KEY', 'cron_service_role_key');
```

3. Apply the migration that switches the cron to use these secrets:

```bash
supabase db push
```

After this, the cron will authenticate correctly and “next batch today after 24 hours” will run as expected.

**Send next batch now (manual trigger):** On the Newsletters page, when any newsletter is in "Batch sending in progress", use the **Send next batch now** button to run the next batch immediately (without waiting for the 15‑min cron). You can also trigger from the terminal (e.g. to run all pending batches across newsletters):

```bash
curl -X POST 'https://kgndpwzqohepotahnfeo.supabase.co/functions/v1/cron-trigger' \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"action": "send-newsletters", "forceNextBatch": true}'
```

Deploy the new edge function so the button works:

```bash
supabase functions deploy trigger-newsletter-batch-now --project-ref kgndpwzqohepotahnfeo
```
