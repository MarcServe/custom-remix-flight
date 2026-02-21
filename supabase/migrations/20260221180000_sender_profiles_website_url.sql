-- Add website_url to sender_profiles for signature website link
ALTER TABLE public.sender_profiles
  ADD COLUMN IF NOT EXISTS website_url TEXT;
