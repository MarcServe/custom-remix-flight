-- Option to hide sender email from signature footer (From: already shows it; keeps one domain/product uniform)
ALTER TABLE business_profiles
  ADD COLUMN IF NOT EXISTS signature_show_email boolean NOT NULL DEFAULT true;

ALTER TABLE sender_profiles
  ADD COLUMN IF NOT EXISTS signature_show_email boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN business_profiles.signature_show_email IS 'When false, email is omitted from the structured signature block (From: header already shows it).';
COMMENT ON COLUMN sender_profiles.signature_show_email IS 'When false, email is omitted from the structured signature block (From: header already shows it).';
