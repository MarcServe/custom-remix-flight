-- Set up cron job for automatic sequence processing (runs every hour)

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension for HTTP requests if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule the process-sequence-steps function to run every hour
SELECT cron.schedule(
  'process-sequences-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://kgndpwzqohepotahnfeo.supabase.co/functions/v1/process-sequence-steps',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtnbmRwd3pxb2hlcG90YWhuZmVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4NDU1MzMsImV4cCI6MjA3NzQyMTUzM30.2bCLyRArq4uFd4eg9TjB2PYq3ewxKCQMcW6C-ZX_nf0'
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);