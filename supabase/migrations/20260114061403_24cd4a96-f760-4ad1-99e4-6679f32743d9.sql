-- Add tags column to companies table
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Create index for efficient tag-based queries
CREATE INDEX IF NOT EXISTS idx_companies_tags ON companies USING GIN(tags);

-- Create company_tag_presets table for reusable tag suggestions
CREATE TABLE IF NOT EXISTS company_tag_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'custom',
  color TEXT DEFAULT 'blue',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, name)
);

-- Enable RLS
ALTER TABLE company_tag_presets ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own tag presets"
ON company_tag_presets FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own tag presets"
ON company_tag_presets FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tag presets"
ON company_tag_presets FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tag presets"
ON company_tag_presets FOR DELETE
USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_company_tag_presets_updated_at
BEFORE UPDATE ON company_tag_presets
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Add comment
COMMENT ON TABLE company_tag_presets IS 'Stores user-defined tag presets for categorizing companies';