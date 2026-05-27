-- Fix: All remaining cron jobs that still use current_setting('app.settings.service_role_key', true)
-- That setting is NULL in pg_cron context → every cron call got "Bearer " → 401 → nothing ran.
-- Switch all of them to read from Vault, same as send-scheduled-newsletters (20260310100000).
-- Requires vault secrets 'cron_project_url' and 'cron_service_role_key' to already exist.

-- 1. process-sequences-hourly (sequences / follow-ups)
SELECT cron.unschedule('process-sequences-hourly');
SELECT cron.schedule(
  'process-sequences-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_project_url' LIMIT 1) || '/functions/v1/cron-trigger',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_service_role_key' LIMIT 1), '')
    ),
    body := '{"action": "process-sequences"}'::jsonb
  ) AS request_id;
  $$
);

-- 2. send-scheduled-campaigns (email campaigns / active campaigns)
SELECT cron.unschedule('send-scheduled-campaigns');
SELECT cron.schedule(
  'send-scheduled-campaigns',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_project_url' LIMIT 1) || '/functions/v1/cron-trigger',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_service_role_key' LIMIT 1), '')
    ),
    body := '{"action": "send-campaigns"}'::jsonb
  ) AS request_id;
  $$
);

-- 3. process-newsletter-series (daily AI newsletter generation)
SELECT cron.unschedule('process-newsletter-series-cron');
SELECT cron.schedule(
  'process-newsletter-series-cron',
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

-- 4. sync-inbound-emails-cron (pull inbound replies from Resend)
SELECT cron.unschedule('sync-inbound-emails-cron');
SELECT cron.schedule(
  'sync-inbound-emails-cron',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_project_url' LIMIT 1) || '/functions/v1/cron-trigger',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_service_role_key' LIMIT 1), '')
    ),
    body := '{"action": "sync-inbound-from-resend"}'::jsonb
  ) AS request_id;
  $$
);

-- 5. process-scheduled-ab-actions (A/B test scheduled resend/swap)
SELECT cron.unschedule('process-scheduled-ab-actions');
SELECT cron.schedule(
  'process-scheduled-ab-actions',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_project_url' LIMIT 1) || '/functions/v1/cron-trigger',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_service_role_key' LIMIT 1), '')
    ),
    body := '{"action": "process-scheduled-ab-actions"}'::jsonb
  ) AS request_id;
  $$
);

-- 6. autonomous-lead-discovery-daily (autopilot lead discovery)
SELECT cron.unschedule('autonomous-lead-discovery-daily');
SELECT cron.schedule(
  'autonomous-lead-discovery-daily',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_project_url' LIMIT 1) || '/functions/v1/cron-trigger',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_service_role_key' LIMIT 1), '')
    ),
    body := '{"action": "discovery"}'::jsonb
  ) AS request_id;
  $$
);
