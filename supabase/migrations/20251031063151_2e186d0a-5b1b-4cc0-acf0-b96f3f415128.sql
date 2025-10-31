-- Add custom instructions to email sequences
ALTER TABLE email_sequences 
ADD COLUMN IF NOT EXISTS custom_instructions TEXT;

-- Add automation rules to company sequences
ALTER TABLE company_sequences 
ADD COLUMN IF NOT EXISTS automation_rules JSONB DEFAULT '{
  "enabled": true,
  "rules": [
    {
      "type": "no_open",
      "wait_hours": 48,
      "action": "send_next"
    },
    {
      "type": "opened_not_clicked",
      "wait_hours": 72,
      "action": "send_next"
    },
    {
      "type": "clicked_not_replied",
      "wait_hours": 96,
      "action": "send_next"
    }
  ]
}'::JSONB;

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule process-sequence-steps to run every hour
SELECT cron.schedule(
  'process-email-sequences',
  '0 * * * *', -- Every hour at minute 0
  $$
  SELECT net.http_post(
    url := 'https://kgndpwzqohepotahnfeo.supabase.co/functions/v1/process-sequence-steps',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtnbmRwd3pxb2hlcG90YWhuZmVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4NDU1MzMsImV4cCI6MjA3NzQyMTUzM30.2bCLyRArq4uFd4eg9TjB2PYq3ewxKCQMcW6C-ZX_nf0"}'::jsonb,
    body := '{"triggered_by": "cron"}'::jsonb
  ) as request_id;
  $$
);