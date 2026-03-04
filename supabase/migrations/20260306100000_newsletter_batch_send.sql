-- Batch send: partition newsletter recipients and send e.g. 400 per day (Gmail ~500/day limit).
ALTER TABLE public.newsletters
  ADD COLUMN IF NOT EXISTS batch_send BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS batch_size INT,
  ADD COLUMN IF NOT EXISTS batch_sent_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS batch_next_at TIMESTAMPTZ;

COMMENT ON COLUMN public.newsletters.batch_send IS 'When true, send only batch_size recipients per run; cron sends next batch when batch_next_at <= now().';
COMMENT ON COLUMN public.newsletters.batch_size IS 'Max recipients per batch (e.g. 400 for Gmail-friendly daily sends).';
COMMENT ON COLUMN public.newsletters.batch_sent_count IS 'Number of recipients already sent in previous batches.';
COMMENT ON COLUMN public.newsletters.batch_next_at IS 'When to send the next batch (e.g. 24h after previous batch).';
