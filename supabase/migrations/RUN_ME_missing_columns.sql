-- Run this in the Supabase Dashboard SQL Editor
-- Adds all missing columns at once

-- Footer image for default branding
ALTER TABLE public.business_profiles
  ADD COLUMN IF NOT EXISTS email_footer_image_url TEXT;

-- Optional header brand name (shown in email header, separate from CRM company name)
ALTER TABLE public.business_profiles
  ADD COLUMN IF NOT EXISTS email_header_name TEXT;

COMMENT ON COLUMN public.business_profiles.email_header_name IS 'Brand name shown in the email header. When null, no name appears in the header. Separate from company_name used in the CRM.';

-- Footer image for sender profiles
ALTER TABLE public.sender_profiles
  ADD COLUMN IF NOT EXISTS footer_image_url TEXT;

-- Display name for sender profiles (brand name in email header)
ALTER TABLE public.sender_profiles
  ADD COLUMN IF NOT EXISTS display_name TEXT;
