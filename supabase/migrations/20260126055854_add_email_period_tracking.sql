-- Add email_period tracking to email_activities and email_campaign_recipients
-- This helps distinguish between old emails (before CRM integration) and new emails (after integration)

-- Add email_period to email_activities
ALTER TABLE email_activities 
ADD COLUMN IF NOT EXISTS email_period TEXT DEFAULT 'new' CHECK (email_period IN ('old', 'new', 'archived'));

-- Add email_period to email_campaign_recipients  
ALTER TABLE email_campaign_recipients
ADD COLUMN IF NOT EXISTS email_period TEXT DEFAULT 'new' CHECK (email_period IN ('old', 'new', 'archived'));

-- Create index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_email_activities_period ON email_activities(email_period, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_campaign_recipients_period ON email_campaign_recipients(email_period, sent_at DESC);

-- Mark existing emails older than 30 days as 'old' (can be adjusted)
-- This assumes emails before CRM integration are old
UPDATE email_activities 
SET email_period = 'old' 
WHERE sent_at IS NOT NULL 
  AND sent_at < NOW() - INTERVAL '30 days'
  AND email_period = 'new';

UPDATE email_campaign_recipients
SET email_period = 'old'
WHERE sent_at IS NOT NULL
  AND sent_at < NOW() - INTERVAL '30 days'
  AND email_period = 'new';

-- Add comments
COMMENT ON COLUMN email_activities.email_period IS 'Tracks email age: old (pre-CRM or >30 days), new (recent), archived (manually archived)';
COMMENT ON COLUMN email_campaign_recipients.email_period IS 'Tracks email age: old (pre-CRM or >30 days), new (recent), archived (manually archived)';
