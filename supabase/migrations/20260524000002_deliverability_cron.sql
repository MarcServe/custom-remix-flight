-- Schedule hourly deliverability metrics update
SELECT cron.schedule(
  'update-deliverability-hourly',
  '30 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_project_url' LIMIT 1) || '/functions/v1/cron-trigger',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_service_role_key' LIMIT 1), '')
    ),
    body := '{"action":"update-deliverability"}'::jsonb
  ) AS request_id;
  $$
);
