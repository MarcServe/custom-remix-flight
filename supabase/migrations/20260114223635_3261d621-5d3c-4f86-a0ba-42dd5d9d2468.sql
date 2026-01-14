-- Add timezone column to autonomous_discovery_settings
ALTER TABLE public.autonomous_discovery_settings 
ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'America/New_York';

-- Add comment explaining the column
COMMENT ON COLUMN public.autonomous_discovery_settings.timezone IS 'User timezone for interpreting preferred_discovery_hour in local time';