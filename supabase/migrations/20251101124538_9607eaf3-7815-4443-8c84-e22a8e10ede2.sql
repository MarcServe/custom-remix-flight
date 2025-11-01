-- Add auto_respond column to email_sequences table
ALTER TABLE email_sequences
ADD COLUMN auto_respond boolean NOT NULL DEFAULT false;

-- Add auto_respond_enabled column to company_sequences table
ALTER TABLE company_sequences
ADD COLUMN auto_respond_enabled boolean NOT NULL DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN email_sequences.auto_respond IS 'When true, AI will automatically respond to replies without manual review';
COMMENT ON COLUMN company_sequences.auto_respond_enabled IS 'When true, this specific sequence instance will auto-respond to replies';