-- Run in Supabase Dashboard > SQL Editor
-- Adds optional footer image to default branding and sender profiles

ALTER TABLE public.business_profiles
  ADD COLUMN IF NOT EXISTS email_footer_image_url TEXT;

ALTER TABLE public.sender_profiles
  ADD COLUMN IF NOT EXISTS footer_image_url TEXT;
