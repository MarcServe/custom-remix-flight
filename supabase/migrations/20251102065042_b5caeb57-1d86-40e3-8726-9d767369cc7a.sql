-- Add tracking and capabilities fields to crm_connections
ALTER TABLE crm_connections 
ADD COLUMN IF NOT EXISTS tracking_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS sending_method text DEFAULT 'direct' CHECK (sending_method IN ('direct', 'api', 'relay')),
ADD COLUMN IF NOT EXISTS capabilities jsonb DEFAULT '{}'::jsonb;

-- Create index for faster queries on tracking_enabled
CREATE INDEX IF NOT EXISTS idx_crm_connections_tracking_enabled ON crm_connections(tracking_enabled) WHERE tracking_enabled = true;

-- Update existing connections with appropriate capabilities based on provider
UPDATE crm_connections
SET 
  tracking_enabled = CASE 
    WHEN provider IN ('gmail', 'outlook', 'resend', 'sendgrid') THEN true
    ELSE false
  END,
  sending_method = CASE 
    WHEN provider = 'smtp' THEN 'direct'
    ELSE 'api'
  END,
  capabilities = CASE 
    WHEN provider = 'gmail' THEN jsonb_build_object(
      'tracking', true,
      'opens', true,
      'clicks', true,
      'replies', true,
      'bounce_detection', true,
      'daily_limit', 500,
      'webhook_support', true,
      'sending_method', 'api'
    )
    WHEN provider = 'outlook' THEN jsonb_build_object(
      'tracking', true,
      'opens', true,
      'clicks', true,
      'replies', true,
      'bounce_detection', true,
      'daily_limit', 500,
      'webhook_support', true,
      'sending_method', 'api'
    )
    WHEN provider = 'resend' THEN jsonb_build_object(
      'tracking', true,
      'opens', true,
      'clicks', true,
      'replies', true,
      'bounce_detection', true,
      'daily_limit', null,
      'webhook_support', true,
      'sending_method', 'api'
    )
    WHEN provider = 'sendgrid' THEN jsonb_build_object(
      'tracking', true,
      'opens', true,
      'clicks', true,
      'replies', true,
      'bounce_detection', true,
      'daily_limit', null,
      'webhook_support', true,
      'advanced_analytics', true,
      'sending_method', 'api'
    )
    WHEN provider = 'smtp' THEN jsonb_build_object(
      'tracking', false,
      'opens', false,
      'clicks', false,
      'replies', false,
      'bounce_detection', false,
      'daily_limit', null,
      'webhook_support', false,
      'sending_method', 'direct'
    )
    ELSE '{}'::jsonb
  END
WHERE capabilities = '{}'::jsonb OR capabilities IS NULL;

-- Add comment to explain the columns
COMMENT ON COLUMN crm_connections.tracking_enabled IS 'Whether this connection supports email tracking (opens, clicks, replies)';
COMMENT ON COLUMN crm_connections.sending_method IS 'How emails are sent: direct (SMTP), api (provider API), or relay (via intermediary)';
COMMENT ON COLUMN crm_connections.capabilities IS 'JSON object containing provider capabilities like tracking, daily_limit, webhook_support, etc.';