-- Cron job to sync inbound emails from Resend into the CRM (backup when webhook doesn't fire)
-- Runs every 10 minutes
SELECT cron.schedule(
  'sync-inbound-from-resend',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://kgndpwzqohepotahnfeo.supabase.co/functions/v1/cron-trigger',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{"action": "sync-inbound-from-resend"}'::jsonb
  ) AS request_id;
  $$
);
