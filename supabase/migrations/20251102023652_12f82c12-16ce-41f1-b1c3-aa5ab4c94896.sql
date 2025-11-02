-- Make company_sequence_id nullable in email_activities to support standalone emails
ALTER TABLE email_activities 
ALTER COLUMN company_sequence_id DROP NOT NULL;

-- Add index for better performance when querying standalone emails
CREATE INDEX IF NOT EXISTS idx_email_activities_contact_id ON email_activities(contact_id);
CREATE INDEX IF NOT EXISTS idx_email_threads_created_at ON email_threads(created_at DESC);