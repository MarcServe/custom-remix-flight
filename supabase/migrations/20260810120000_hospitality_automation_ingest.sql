-- Opt-in settings for daily hospitality lead ingest → groups / campaigns / newsletters
CREATE TABLE IF NOT EXISTS public.hospitality_automation_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  markets TEXT[] NOT NULL DEFAULT ARRAY['US', 'UK']::TEXT[],
  leads_base_url TEXT,
  create_crm BOOLEAN NOT NULL DEFAULT true,
  create_campaigns BOOLEAN NOT NULL DEFAULT true,
  create_newsletters BOOLEAN NOT NULL DEFAULT true,
  create_newsletter_series BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMPTZ,
  last_run_result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.hospitality_automation_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own hospitality automation settings"
  ON public.hospitality_automation_settings
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE public.hospitality_automation_settings IS
  'When enabled, daily cron runs ingest-hospitality-leads for verified UK/US hospitality emails into recipient groups, campaigns, and newsletter series.';

-- Daily hospitality ingest at 08:15 UTC for opted-in users
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'hospitality-leads-daily-ingest') THEN
    PERFORM cron.unschedule('hospitality-leads-daily-ingest');
  END IF;
END $$;

SELECT cron.schedule(
  'hospitality-leads-daily-ingest',
  '15 8 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_project_url' LIMIT 1) || '/functions/v1/cron-trigger',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_service_role_key' LIMIT 1), '')
    ),
    body := '{"action": "hospitality-ingest"}'::jsonb
  );
  $$
);
