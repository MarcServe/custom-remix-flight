-- Add auto-response safety controls to business_profiles
ALTER TABLE business_profiles
ADD COLUMN IF NOT EXISTS auto_response_daily_limit integer DEFAULT 10,
ADD COLUMN IF NOT EXISTS auto_response_paused boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS auto_response_count_today integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS auto_response_last_reset_date date DEFAULT CURRENT_DATE;

-- Add index for efficient daily count queries
CREATE INDEX IF NOT EXISTS idx_business_profiles_auto_response 
ON business_profiles(user_id, auto_response_last_reset_date);