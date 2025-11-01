-- Add AI configuration columns to business_profiles
ALTER TABLE business_profiles
ADD COLUMN IF NOT EXISTS ai_model TEXT DEFAULT 'google/gemini-2.5-flash',
ADD COLUMN IF NOT EXISTS ai_temperature DECIMAL(2,1) DEFAULT 0.7,
ADD COLUMN IF NOT EXISTS ai_max_tokens INTEGER DEFAULT 500,
ADD COLUMN IF NOT EXISTS ai_response_style TEXT DEFAULT 'professional';

-- Add index for AI configuration
CREATE INDEX IF NOT EXISTS idx_business_profiles_ai_model ON business_profiles(ai_model);

COMMENT ON COLUMN business_profiles.ai_model IS 'AI model used for auto-responses (google/gemini-2.5-flash, google/gemini-2.5-pro, openai/gpt-5-mini, etc.)';
COMMENT ON COLUMN business_profiles.ai_temperature IS 'Temperature setting for AI responses (0.0-1.0)';
COMMENT ON COLUMN business_profiles.ai_max_tokens IS 'Maximum tokens for AI responses';
COMMENT ON COLUMN business_profiles.ai_response_style IS 'Style of auto-responses (professional, casual, technical)';