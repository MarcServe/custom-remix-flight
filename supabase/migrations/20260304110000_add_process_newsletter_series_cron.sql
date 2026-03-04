-- Cron to process newsletter series: daily AI-generated sends at configured time (e.g. 9:00 AM London)
SELECT cron.schedule(
  'process-newsletter-series',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://kgndpwzqohepotahnfeo.supabase.co/functions/v1/cron-trigger',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{"action": "process-newsletter-series"}'::jsonb
  ) AS request_id;
  $$
);
