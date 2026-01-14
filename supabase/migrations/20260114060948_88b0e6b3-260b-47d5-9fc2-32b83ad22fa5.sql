-- Add preferred_discovery_hour column for users to customize their delivery time
ALTER TABLE autonomous_discovery_settings 
ADD COLUMN IF NOT EXISTS preferred_discovery_hour INTEGER DEFAULT 9;

-- Add constraint separately to avoid issues
ALTER TABLE autonomous_discovery_settings 
ADD CONSTRAINT check_preferred_discovery_hour 
CHECK (preferred_discovery_hour >= 0 AND preferred_discovery_hour <= 23);

-- Add comment for documentation
COMMENT ON COLUMN autonomous_discovery_settings.preferred_discovery_hour IS 'Hour of day (0-23 UTC) when user prefers to receive discovered leads';

-- Schedule autonomous lead discovery to run every day at 9:00 AM UTC
-- Using pg_net to call the edge function
SELECT cron.schedule(
  'autonomous-lead-discovery-daily',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := 'https://kgndpwzqohepotahnfeo.supabase.co/functions/v1/autonomous-lead-discovery',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtnbmRwd3pxb2hlcG90YWhuZmVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4NDU1MzMsImV4cCI6MjA3NzQyMTUzM30.2bCLyRArq4uFd4eg9TjB2PYq3ewxKCQMcW6C-ZX_nf0'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);