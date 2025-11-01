-- Add email branding columns to business_profiles
ALTER TABLE business_profiles
ADD COLUMN IF NOT EXISTS email_logo_url TEXT,
ADD COLUMN IF NOT EXISTS email_brand_color TEXT DEFAULT '#8b5cf6',
ADD COLUMN IF NOT EXISTS email_footer_text TEXT,
ADD COLUMN IF NOT EXISTS email_signature TEXT,
ADD COLUMN IF NOT EXISTS email_template_style TEXT DEFAULT 'professional';

COMMENT ON COLUMN business_profiles.email_logo_url IS 'URL to company logo for email branding';
COMMENT ON COLUMN business_profiles.email_brand_color IS 'Primary brand color for emails (hex format)';
COMMENT ON COLUMN business_profiles.email_footer_text IS 'Custom footer text for emails';
COMMENT ON COLUMN business_profiles.email_signature IS 'Custom email signature HTML';
COMMENT ON COLUMN business_profiles.email_template_style IS 'Email template style (professional, minimal, modern)';