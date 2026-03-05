-- Timezone for sending window: start/end hours are in this timezone when set; when null, hours are UTC.
ALTER TABLE public.business_profiles
  ADD COLUMN IF NOT EXISTS newsletter_cron_timezone TEXT;

COMMENT ON COLUMN public.business_profiles.newsletter_cron_timezone IS 'IANA timezone (e.g. Europe/London) for cron sending window. When set, newsletter_cron_start_hour_utc and newsletter_cron_end_hour_utc are local to this timezone; when null, they are UTC.';
