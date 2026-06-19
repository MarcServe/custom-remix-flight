-- Run this in Supabase Dashboard > SQL Editor
-- Adds ALL missing columns across tables in one go

-- business_profiles
ALTER TABLE public.business_profiles
  ADD COLUMN IF NOT EXISTS email_footer_image_url TEXT;
ALTER TABLE public.business_profiles
  ADD COLUMN IF NOT EXISTS email_header_name TEXT;
ALTER TABLE public.business_profiles
  ADD COLUMN IF NOT EXISTS email_sender_image_url TEXT;
ALTER TABLE public.business_profiles
  ADD COLUMN IF NOT EXISTS email_sender_name TEXT;
ALTER TABLE public.business_profiles
  ADD COLUMN IF NOT EXISTS email_sender_title TEXT;
ALTER TABLE public.business_profiles
  ADD COLUMN IF NOT EXISTS email_sender_email TEXT;

-- profiles (for default founder image fallback)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- sender_profiles
ALTER TABLE public.sender_profiles
  ADD COLUMN IF NOT EXISTS footer_image_url TEXT;
ALTER TABLE public.sender_profiles
  ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE public.sender_profiles
  ADD COLUMN IF NOT EXISTS sender_name TEXT;
ALTER TABLE public.sender_profiles
  ADD COLUMN IF NOT EXISTS sender_email TEXT;
ALTER TABLE public.sender_profiles
  ADD COLUMN IF NOT EXISTS sender_title TEXT;
ALTER TABLE public.sender_profiles
  ADD COLUMN IF NOT EXISTS sender_image_url TEXT;
ALTER TABLE public.sender_profiles
  ADD COLUMN IF NOT EXISTS website_url TEXT;
