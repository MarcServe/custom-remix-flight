-- Add auto_extract_emails setting to autonomous_discovery_settings
ALTER TABLE public.autonomous_discovery_settings
ADD COLUMN IF NOT EXISTS auto_extract_emails boolean DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.autonomous_discovery_settings.auto_extract_emails IS 'When enabled, automatically extract emails for auto-approved leads during discovery';