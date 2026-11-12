-- Newsletter Series is back in the UI, so its background job must stay scheduled.
-- 20260618200000 unscheduled it; production already has exactly one active
-- 'process-newsletter-series' job again. This migration records that state so the
-- repo and production agree (idempotent: safe to run where the job already exists).
DO $$
BEGIN
  PERFORM cron.unschedule('process-newsletter-series');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'process-newsletter-series',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_project_url' LIMIT 1) || '/functions/v1/cron-trigger',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_service_role_key' LIMIT 1), '')
    ),
    body := '{"action": "process-newsletter-series"}'::jsonb
  ) AS request_id;
  $$
);
