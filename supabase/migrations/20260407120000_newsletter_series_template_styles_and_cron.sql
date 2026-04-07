-- Rotating email template designs per day in a newsletter series (cycles with header images)
ALTER TABLE public.newsletter_series
  ADD COLUMN IF NOT EXISTS template_styles JSONB DEFAULT NULL;

COMMENT ON COLUMN public.newsletter_series.template_styles IS 'Optional JSON array of template_style keys (e.g. ["professional","modern","minimal"]); each day uses the next style, cycling.';

-- Use Vault for auth like send-scheduled-newsletters (see 20260310100000_cron_use_vault_for_auth.sql)
SELECT cron.unschedule('process-newsletter-series');

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
