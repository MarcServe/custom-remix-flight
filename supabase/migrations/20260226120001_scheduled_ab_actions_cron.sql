-- Cron to process due scheduled Resend/Swap A/B actions (A/B Testing → Schedule tab)
SELECT cron.schedule(
  'process-scheduled-ab-actions',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://kgndpwzqohepotahnfeo.supabase.co/functions/v1/cron-trigger',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{"action": "process-scheduled-ab-actions"}'::jsonb
  ) AS request_id;
  $$
);
