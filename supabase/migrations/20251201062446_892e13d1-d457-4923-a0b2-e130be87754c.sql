-- Add temperature/category field to companies for Hot/Warm/Cold classification
ALTER TABLE companies ADD COLUMN IF NOT EXISTS temperature text CHECK (temperature IN ('hot', 'warm', 'cold'));

-- Add suggested_actions field to store AI-generated next actions
ALTER TABLE companies ADD COLUMN IF NOT EXISTS suggested_actions jsonb DEFAULT '[]'::jsonb;

-- Add last_analyzed_at timestamp to track when AI last analyzed this company
ALTER TABLE companies ADD COLUMN IF NOT EXISTS last_analyzed_at timestamp with time zone;

-- Create index for faster filtering by temperature
CREATE INDEX IF NOT EXISTS idx_companies_temperature ON companies(temperature) WHERE temperature IS NOT NULL;