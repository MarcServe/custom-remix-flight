-- Add sender identity fields to sender_profiles so each profile can send as a different person/email
ALTER TABLE public.sender_profiles
  ADD COLUMN IF NOT EXISTS sender_name TEXT,
  ADD COLUMN IF NOT EXISTS sender_email TEXT,
  ADD COLUMN IF NOT EXISTS sender_title TEXT;

COMMENT ON COLUMN public.sender_profiles.sender_name IS 'Display name shown in the From header (e.g. "Michael Orji"). Falls back to profiles.full_name when null.';
COMMENT ON COLUMN public.sender_profiles.sender_email IS 'From email address for this profile. Falls back to connection from_email or profiles.email when null.';
COMMENT ON COLUMN public.sender_profiles.sender_title IS 'Job title used in email signatures for this profile. Falls back to profiles.job_title when null.';
