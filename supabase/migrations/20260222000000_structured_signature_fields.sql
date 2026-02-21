-- Structured signature: closing line, phone, address, and mode (structured vs custom)
-- business_profiles
ALTER TABLE public.business_profiles ADD COLUMN IF NOT EXISTS email_signature_closing TEXT;
ALTER TABLE public.business_profiles ADD COLUMN IF NOT EXISTS email_sender_phone TEXT;
ALTER TABLE public.business_profiles ADD COLUMN IF NOT EXISTS email_sender_address TEXT;
ALTER TABLE public.business_profiles ADD COLUMN IF NOT EXISTS email_signature_use_structured BOOLEAN DEFAULT true;

-- sender_profiles
ALTER TABLE public.sender_profiles ADD COLUMN IF NOT EXISTS signature_closing TEXT;
ALTER TABLE public.sender_profiles ADD COLUMN IF NOT EXISTS sender_phone TEXT;
ALTER TABLE public.sender_profiles ADD COLUMN IF NOT EXISTS sender_address TEXT;
ALTER TABLE public.sender_profiles ADD COLUMN IF NOT EXISTS signature_use_structured BOOLEAN DEFAULT true;
