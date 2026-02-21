-- Add missing email branding columns to business_profiles (fixes "email_sender_email" schema cache error)
ALTER TABLE public.business_profiles ADD COLUMN IF NOT EXISTS email_footer_image_url TEXT;
ALTER TABLE public.business_profiles ADD COLUMN IF NOT EXISTS email_header_name TEXT;
ALTER TABLE public.business_profiles ADD COLUMN IF NOT EXISTS email_sender_image_url TEXT;
ALTER TABLE public.business_profiles ADD COLUMN IF NOT EXISTS email_sender_name TEXT;
ALTER TABLE public.business_profiles ADD COLUMN IF NOT EXISTS email_sender_title TEXT;
ALTER TABLE public.business_profiles ADD COLUMN IF NOT EXISTS email_sender_email TEXT;
ALTER TABLE public.business_profiles ADD COLUMN IF NOT EXISTS website TEXT;
