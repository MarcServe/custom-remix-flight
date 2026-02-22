-- Separate "signature name" from "sender/From name" so they are independent.
-- Sender name = name in the From line (e.g. "Sales Team").
-- Signature name = name shown in the email signature block (e.g. "John Smith").

ALTER TABLE public.business_profiles
  ADD COLUMN IF NOT EXISTS email_signature_name TEXT;

COMMENT ON COLUMN public.business_profiles.email_signature_name IS 'Name shown in the email signature block only. Independent of email_sender_name (From line).';

ALTER TABLE public.sender_profiles
  ADD COLUMN IF NOT EXISTS signature_name TEXT;

COMMENT ON COLUMN public.sender_profiles.signature_name IS 'Name shown in the email signature block only. Independent of sender_name (From line).';
