-- Clean up duplicate and broken cron jobs left over from earlier migrations.
--
-- Problems:
-- 1. autonomous-lead-discovery-hourly  → broken current_setting auth; superseded by -daily
-- 2. process-email-sequences           → broken/unknown auth; superseded by process-sequences-hourly
-- 3. process-newsletter-series-cron    → valid vault auth but DUPLICATE of process-newsletter-series
--                                        (both run every 15 min → newsletter series processed twice)
-- 4. sync-inbound-from-resend          → broken current_setting auth; superseded by sync-inbound-emails-cron
--
-- All essential work is covered by the surviving crons already using Vault auth.

SELECT cron.unschedule('autonomous-lead-discovery-hourly');
SELECT cron.unschedule('process-email-sequences');
SELECT cron.unschedule('process-newsletter-series-cron');
SELECT cron.unschedule('sync-inbound-from-resend');
