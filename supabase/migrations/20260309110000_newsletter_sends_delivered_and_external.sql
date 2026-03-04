-- Track Resend message id and delivery for newsletter_sends (webhook + sync from Resend)
ALTER TABLE public.newsletter_sends
  ADD COLUMN IF NOT EXISTS external_message_id TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

COMMENT ON COLUMN public.newsletter_sends.external_message_id IS 'Resend (or provider) message id for webhook/sync matching';
COMMENT ON COLUMN public.newsletter_sends.delivered_at IS 'When provider reported delivery; enables Delivered / Delivered not opened segments';

CREATE INDEX IF NOT EXISTS idx_newsletter_sends_external_message_id ON public.newsletter_sends(external_message_id) WHERE external_message_id IS NOT NULL;
