-- Add unique constraint on website (allowing NULL for companies without websites)
ALTER TABLE companies 
ADD CONSTRAINT companies_website_unique UNIQUE NULLS NOT DISTINCT (website);

-- Add new enrichment fields for enhanced data
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS company_phone TEXT,
ADD COLUMN IF NOT EXISTS general_email TEXT,
ADD COLUMN IF NOT EXISTS social_profiles JSONB,
ADD COLUMN IF NOT EXISTS key_executives JSONB;

-- Add index for faster website lookups
CREATE INDEX IF NOT EXISTS idx_companies_website ON companies(website) WHERE website IS NOT NULL;