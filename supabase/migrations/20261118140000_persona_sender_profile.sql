-- Each Autopilot persona sends under its own brand: sender profile (name, From address, logo, signature).
ALTER TABLE public.discovery_personas
  ADD COLUMN IF NOT EXISTS sender_profile_id uuid REFERENCES public.sender_profiles(id) ON DELETE SET NULL;
