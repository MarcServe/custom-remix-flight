-- Cron job to send scheduled campaigns (required for Autopilot full auto mode)
-- Runs every 15 minutes to pick up campaigns created by autonomous-lead-discovery
-- that have reached their scheduled_at time
SELECT cron.schedule(
  'send-scheduled-campaigns',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://kgndpwzqohepotahnfeo.supabase.co/functions/v1/cron-trigger',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{"action": "send-campaigns"}'::jsonb
  ) AS request_id;
  $$
);
