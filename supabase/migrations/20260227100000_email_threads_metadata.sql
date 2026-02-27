-- Add metadata JSONB to email_threads for webhook/sync bookkeeping (e.g. resend_email_id)
ALTER TABLE email_threads ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
