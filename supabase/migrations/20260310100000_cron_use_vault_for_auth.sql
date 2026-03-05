-- Fix: cron was using current_setting('app.settings.service_role_key', true) which is
-- unset in pg_cron, so the edge function got "Bearer " and returned 401. Batch newsletters
-- (e.g. "next batch after 24h" when Gmail daily cap is hit) never ran.
-- This migration switches to Supabase Vault for the project URL and service role key.
-- One-time: create the vault secrets in Dashboard → SQL Editor (see docs/SUPABASE_DEPLOY.md).

SELECT cron.unschedule('send-scheduled-newsletters');

SELECT cron.schedule(
  'send-scheduled-newsletters',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_project_url' LIMIT 1) || '/functions/v1/cron-trigger',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_service_role_key' LIMIT 1), '')
    ),
    body := '{"action": "send-newsletters"}'::jsonb
  ) AS request_id;
  $$
);
