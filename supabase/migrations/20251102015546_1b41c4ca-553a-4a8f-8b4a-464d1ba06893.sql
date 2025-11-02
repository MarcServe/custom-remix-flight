-- Step 2: Add thread tracking columns to email_activities
ALTER TABLE email_activities 
ADD COLUMN IF NOT EXISTS thread_id TEXT,
ADD COLUMN IF NOT EXISTS in_reply_to TEXT;

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_email_activities_thread_id ON email_activities(thread_id);
CREATE INDEX IF NOT EXISTS idx_email_activities_external_message_id ON email_activities(external_message_id);
CREATE INDEX IF NOT EXISTS idx_email_threads_message_id ON email_threads(message_id);
CREATE INDEX IF NOT EXISTS idx_email_threads_thread_id ON email_threads(thread_id);

-- Add index for contact_id lookups (for CRM emails)
CREATE INDEX IF NOT EXISTS idx_email_activities_contact_id ON email_activities(contact_id);

COMMENT ON COLUMN email_activities.thread_id IS 'Links multiple emails in a conversation thread';
COMMENT ON COLUMN email_activities.in_reply_to IS 'Message-ID of the email this is replying to';