-- Re-enable Newsletter Series daily processing (single cron job only).
-- Previously unscheduled in 20260618200000 when the UI was retired.
-- UI is restored; keep ONE job named process-newsletter-series (no duplicate).

DO $$
BEGIN
  PERFORM cron.unschedule('process-newsletter-series');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('process-newsletter-series-cron');
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
  );
  $$
);

COMMENT ON TABLE public.newsletter_series IS
  'Daily AI newsletter series (7/14/30+ days). Cron process-newsletter-series runs every 15 min; editions send after send_time to scheduled_send_options.recipientGroupIds (or all active).';
