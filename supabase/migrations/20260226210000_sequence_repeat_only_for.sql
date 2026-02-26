-- Repeat only for: restrict who gets the repeat (avoid duplicates for those who replied/clicked/opened)
ALTER TABLE email_sequences
  ADD COLUMN IF NOT EXISTS repeat_only_for text NOT NULL DEFAULT 'no_reply';

COMMENT ON COLUMN email_sequences.repeat_only_for IS 'When repeating: all | not_opened | opened_not_clicked | clicked_not_replied | no_reply. Only restart for contacts matching this (e.g. no_reply = do not re-send to those who replied).';
