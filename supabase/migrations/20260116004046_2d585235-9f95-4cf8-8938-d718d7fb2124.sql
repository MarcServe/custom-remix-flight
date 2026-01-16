-- Drop old constraint
ALTER TABLE business_profiles 
DROP CONSTRAINT IF EXISTS business_profiles_email_provider_check;

-- Add new constraint with all valid providers
ALTER TABLE business_profiles 
ADD CONSTRAINT business_profiles_email_provider_check 
CHECK (email_provider = ANY (ARRAY['resend', 'sendgrid', 'gmail_direct', 'smtp', 'gmail']));