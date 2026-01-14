-- Add marketing fields to discovery_personas table
ALTER TABLE discovery_personas ADD COLUMN IF NOT EXISTS product_focus TEXT;
ALTER TABLE discovery_personas ADD COLUMN IF NOT EXISTS value_proposition TEXT;
ALTER TABLE discovery_personas ADD COLUMN IF NOT EXISTS email_tone TEXT DEFAULT 'professional';
ALTER TABLE discovery_personas ADD COLUMN IF NOT EXISTS talking_points TEXT[];
ALTER TABLE discovery_personas ADD COLUMN IF NOT EXISTS call_to_action TEXT;
ALTER TABLE discovery_personas ADD COLUMN IF NOT EXISTS email_signature_override TEXT;