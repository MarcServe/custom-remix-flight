-- Increase default max_leads_per_run for better autopilot lead volume
-- Only affects new rows; existing settings keep their values
-- Uses DO block so migration won't fail if table doesn't exist yet (e.g. fresh DB, different migration order)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'autonomous_discovery_settings'
  ) THEN
    ALTER TABLE public.autonomous_discovery_settings 
      ALTER COLUMN max_leads_per_run SET DEFAULT 100;
  END IF;
END $$;
