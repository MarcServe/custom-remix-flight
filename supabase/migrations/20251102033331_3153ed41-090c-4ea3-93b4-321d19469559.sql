-- Add email_provider column to business_profiles table
ALTER TABLE business_profiles 
ADD COLUMN IF NOT EXISTS email_provider TEXT DEFAULT 'resend' CHECK (email_provider IN ('resend', 'sendgrid'));

-- Add comment to document the column
COMMENT ON COLUMN business_profiles.email_provider IS 'Preferred email sending provider: resend or sendgrid';