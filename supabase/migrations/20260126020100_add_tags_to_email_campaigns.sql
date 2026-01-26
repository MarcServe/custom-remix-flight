-- Add tags column to email_campaigns table for campaign categorization
ALTER TABLE email_campaigns 
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT NULL;

-- Create index for efficient tag-based queries
CREATE INDEX IF NOT EXISTS idx_email_campaigns_tags ON email_campaigns USING GIN(tags);

-- Add comment
COMMENT ON COLUMN email_campaigns.tags IS 'Tags for categorizing campaigns and filtering contacts';
