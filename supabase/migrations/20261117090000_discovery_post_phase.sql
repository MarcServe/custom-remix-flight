-- Autopilot: the campaign/summary step ("post phase") is triggered when the email lookup chain
-- finishes (and by a 5-minute fallback). This column lets the first caller claim it so it runs once.
ALTER TABLE public.discovery_runs ADD COLUMN IF NOT EXISTS post_phase_at timestamptz;
