-- Founder image = person photo in footer; Footer business logo = company logo in footer (different)
ALTER TABLE public.business_profiles ADD COLUMN IF NOT EXISTS email_footer_logo_url TEXT;
ALTER TABLE public.sender_profiles ADD COLUMN IF NOT EXISTS footer_logo_url TEXT;
