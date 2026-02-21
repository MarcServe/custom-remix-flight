-- Run in Supabase Dashboard > SQL Editor
-- Adds per-profile sender signature image to sender_profiles

ALTER TABLE public.sender_profiles
  ADD COLUMN IF NOT EXISTS sender_image_url TEXT;

COMMENT ON COLUMN public.sender_profiles.sender_image_url IS 'Circular image shown in the email signature next to the sender name. Falls back to profiles.avatar_url when null.';
