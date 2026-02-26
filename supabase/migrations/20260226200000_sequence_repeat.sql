-- Repeat sequence: when enabled, after the last step the sequence restarts after N days
ALTER TABLE email_sequences
  ADD COLUMN IF NOT EXISTS repeat_sequence boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS repeat_after_days integer NOT NULL DEFAULT 5;

COMMENT ON COLUMN email_sequences.repeat_sequence IS 'When true, after the sequence completes it restarts after repeat_after_days.';
COMMENT ON COLUMN email_sequences.repeat_after_days IS 'Days to wait after completion before restarting the sequence (used when repeat_sequence is true).';
