-- Track which connection sent each newsletter_sends row (for per-connection daily limit).
ALTER TABLE public.newsletter_sends
  ADD COLUMN IF NOT EXISTS sender_connection_id UUID REFERENCES public.crm_connections(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.newsletter_sends.sender_connection_id IS 'Connection used to send this email; used to enforce daily send limit per Gmail/sender.';

CREATE INDEX IF NOT EXISTS idx_newsletter_sends_sender_connection_sent_at
  ON public.newsletter_sends(sender_connection_id, sent_at)
  WHERE sender_connection_id IS NOT NULL AND status = 'sent';
