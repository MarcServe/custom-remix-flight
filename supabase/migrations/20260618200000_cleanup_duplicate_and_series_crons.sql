-- Applied to production 2026-06-18 via one-shot runner; this migration records it so
-- local and prod cron state finally agree.
--
-- Problems found in production (live cron.job inspection):
--   1. process-newsletter-series + process-newsletter-series-cron  → BOTH active */15
--      (Newsletter Series generated/sent twice every 15 min — the "series not working" bug)
--   2. process-email-sequences (old jobid 1) duplicated process-sequences-hourly
--   3. sync-inbound-from-resend (*/10) duplicated sync-inbound-emails-cron (*/30)
--
-- The earlier cleanup migration (20260528000001) was never applied to prod
-- (CLI `db push` blocked by a DB-password mismatch), so these zombies survived.
--
-- Newsletter Series is being retired from the UI; we also stop its background
-- processing here. The newsletter_series tables and the process-newsletter-series
-- edge function are intentionally KEPT so the feature can be re-enabled later by
-- re-scheduling the cron.

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

DO $$
BEGIN
  PERFORM cron.unschedule('process-email-sequences');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('sync-inbound-from-resend');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
