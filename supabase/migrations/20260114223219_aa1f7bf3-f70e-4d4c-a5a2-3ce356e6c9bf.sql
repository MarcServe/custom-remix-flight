-- Remove the old daily 9AM cron job if it exists
SELECT cron.unschedule('autonomous-lead-discovery-daily');

-- Create new hourly cron job that runs every hour at minute 0
-- The edge function will filter users based on their preferred_discovery_hour
SELECT cron.schedule(
  'autonomous-lead-discovery-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://kgndpwzqohepotahnfeo.supabase.co/functions/v1/autonomous-lead-discovery',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);