ALTER TABLE public.sender_profiles
  ADD COLUMN IF NOT EXISTS display_name TEXT;

COMMENT ON COLUMN public.sender_profiles.display_name IS 'Brand / company name shown in email headers. When null, falls back to business_profiles.company_name. The "name" column is for internal identification only.';
