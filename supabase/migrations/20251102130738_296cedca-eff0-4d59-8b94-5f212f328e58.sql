-- Set all existing contacts to verified (for B2B CRM where contacts are manually curated)
UPDATE contacts SET email_verified = true WHERE email_verified = false;

-- Update the default for new contacts to be verified by default
ALTER TABLE contacts ALTER COLUMN email_verified SET DEFAULT true;