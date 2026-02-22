-- Cron job to send scheduled newsletters
-- Runs every 15 minutes to pick up newsletters with status = 'scheduled' and scheduled_at <= now()
SELECT cron.schedule(
  'send-scheduled-newsletters',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://kgndpwzqohepotahnfeo.supabase.co/functions/v1/cron-trigger',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{"action": "send-newsletters"}'::jsonb
  ) AS request_id;
  $$
);
