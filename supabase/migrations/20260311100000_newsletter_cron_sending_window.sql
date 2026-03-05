-- Configurable sending window for newsletter cron (UTC hours 0-23).
-- Cron still runs every 15 min; we only process when current hour is within [start, end].
-- Default: start 9 (9:00 AM UTC), end 22 (10:00 PM UTC).
ALTER TABLE public.business_profiles
  ADD COLUMN IF NOT EXISTS newsletter_cron_start_hour_utc INT,
  ADD COLUMN IF NOT EXISTS newsletter_cron_end_hour_utc INT;

COMMENT ON COLUMN public.business_profiles.newsletter_cron_start_hour_utc IS 'UTC hour (0-23) when batch/scheduled newsletter sending may start. Default 9 (9:00 AM UTC).';
COMMENT ON COLUMN public.business_profiles.newsletter_cron_end_hour_utc IS 'UTC hour (0-23) when batch/scheduled newsletter sending must stop. Default 22 (10:00 PM UTC).';

-- Set defaults for existing rows so "9 AM start" is applied
UPDATE public.business_profiles
SET newsletter_cron_start_hour_utc = 9, newsletter_cron_end_hour_utc = 22
WHERE newsletter_cron_start_hour_utc IS NULL AND newsletter_cron_end_hour_utc IS NULL;
