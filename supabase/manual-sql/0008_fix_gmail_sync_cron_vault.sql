-- Fix: 0007 used wrong vault secret names (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).
-- All other crons use 'cron_project_url' and 'cron_service_role_key' (set via Vault).
-- Reschedule with correct names.

SELECT cron.unschedule('sync-gmail-replies-hourly');

SELECT cron.schedule(
  'sync-gmail-replies-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_project_url' LIMIT 1) || '/functions/v1/cron-trigger',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_service_role_key' LIMIT 1), '')
    ),
    body := '{"action":"sync-gmail-replies"}'::jsonb
  ) AS request_id;
  $$
);
