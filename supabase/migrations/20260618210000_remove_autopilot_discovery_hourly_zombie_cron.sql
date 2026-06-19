-- Applied to production 2026-06-18 via one-shot runner; recorded here for parity.
--
-- autopilot-discovery-hourly (jobid 5) was a pre-Vault leftover that:
--   * ran HOURLY (0 * * * *) calling cron-trigger with {"action":"discovery"}
--   * sent NO Authorization header (just Content-Type) — pre-vault style
--   * duplicated autonomous-lead-discovery-daily (jobid 140, daily 09:00, Vault auth)
--
-- It fired every hour (confirmed in cron.job_run_details), triggering autonomous
-- lead discovery up to 24x/day and burning Apify/Exa/OpenAI credits. The earlier
-- cleanup migration (20260528000001) intended to remove the hourly discovery job
-- but targeted the name 'autonomous-lead-discovery-hourly'; the live job was named
-- 'autopilot-discovery-hourly', so it survived. This removes it for good.
--
-- Daily discovery (autonomous-lead-discovery-daily) remains the single source.

DO $$
BEGIN
  PERFORM cron.unschedule('autopilot-discovery-hourly');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
