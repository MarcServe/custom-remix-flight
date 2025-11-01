-- Add missing updated_at column to people table
ALTER TABLE people 
ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW();

-- Create trigger to automatically update the updated_at column
CREATE TRIGGER update_people_updated_at
  BEFORE UPDATE ON people
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_updated_at();