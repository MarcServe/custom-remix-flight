-- Add signature_company to sender_profiles (company name in structured signature)
ALTER TABLE public.sender_profiles ADD COLUMN IF NOT EXISTS signature_company TEXT;
COMMENT ON COLUMN public.sender_profiles.signature_company IS 'Company name shown in structured email signature (e.g. under sender title).';
