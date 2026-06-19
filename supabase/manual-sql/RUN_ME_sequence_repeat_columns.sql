-- Run this in Supabase Dashboard → SQL Editor if you see:
-- "Could not find the 'repeat_after_days' column of 'email_sequences' in the schema cache"
-- This adds the repeat sequence columns to email_sequences.

-- 1. Repeat sequence + days
ALTER TABLE email_sequences
  ADD COLUMN IF NOT EXISTS repeat_sequence boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS repeat_after_days integer NOT NULL DEFAULT 5;

COMMENT ON COLUMN email_sequences.repeat_sequence IS 'When true, after the sequence completes it restarts after repeat_after_days.';
COMMENT ON COLUMN email_sequences.repeat_after_days IS 'Days to wait after completion before restarting the sequence (used when repeat_sequence is true).';

-- 2. Repeat only for (who gets the repeat)
ALTER TABLE email_sequences
  ADD COLUMN IF NOT EXISTS repeat_only_for text NOT NULL DEFAULT 'no_reply';

COMMENT ON COLUMN email_sequences.repeat_only_for IS 'When repeating: all | not_opened | opened_not_clicked | clicked_not_replied | no_reply. Only restart for contacts matching this.';
