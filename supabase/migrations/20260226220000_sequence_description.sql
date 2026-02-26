-- Sequence description: human-editable notes for traceability when the CRM has many sequences
ALTER TABLE email_sequences
  ADD COLUMN IF NOT EXISTS description text;

COMMENT ON COLUMN email_sequences.description IS 'Optional user-editable description for traceability (e.g. target audience, campaign, product). Distinct from custom_instructions which are for AI behavior.';
