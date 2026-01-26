-- Add tags column to people table for contact categorization
ALTER TABLE people 
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Create index for efficient tag-based queries
CREATE INDEX IF NOT EXISTS idx_people_tags ON people USING GIN(tags);

-- Add comment
COMMENT ON COLUMN people.tags IS 'Tags for categorizing and filtering contacts in campaigns';
