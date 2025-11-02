-- Drop foreign key constraint to allow sending emails to any recipient
-- This enables sending emails without requiring the recipient to be in the contacts table
ALTER TABLE email_activities 
DROP CONSTRAINT IF EXISTS email_activities_contact_id_fkey;

-- Add a comment to document the intentional flexibility
COMMENT ON COLUMN email_activities.contact_id IS 'Optional link to contacts table. Null when emailing recipients not in contacts.';
