-- Cron job to auto-send sequence steps (follow-ups) for active company sequences
-- Runs every hour; process-sequence-steps sends due steps based on automation rules / delay
SELECT cron.unschedule('process-sequences-hourly');
SELECT cron.schedule(
  'process-sequences-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://kgndpwzqohepotahnfeo.supabase.co/functions/v1/cron-trigger',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{"action": "process-sequences"}'::jsonb
  ) AS request_id;
  $$
);
