-- Track each send per recipient per campaign so we never send the same variant twice
-- and can show full history (initial send + resends/swaps) in the report.
CREATE TABLE IF NOT EXISTS public.email_campaign_send_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES email_campaigns(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES email_campaign_recipients(id) ON DELETE CASCADE,
  variant_sent TEXT NOT NULL CHECK (variant_sent IN ('A', 'B')),
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaign_send_history_campaign_recipient
  ON public.email_campaign_send_history(campaign_id, recipient_id);
CREATE INDEX IF NOT EXISTS idx_campaign_send_history_campaign_sent
  ON public.email_campaign_send_history(campaign_id, sent_at DESC);

ALTER TABLE public.email_campaign_send_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view send history of their campaigns"
ON public.email_campaign_send_history FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM email_campaigns c
    WHERE c.id = email_campaign_send_history.campaign_id
    AND c.user_id = auth.uid()
  )
);

CREATE POLICY "Service can insert send history"
ON public.email_campaign_send_history FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM email_campaigns c
    WHERE c.id = email_campaign_send_history.campaign_id
    AND c.user_id = auth.uid()
  )
);

COMMENT ON TABLE public.email_campaign_send_history IS 'One row per email sent per campaign recipient (initial + resends). Used to avoid resending same variant and to show full delivery history.';

-- Backfill: one row per recipient who has been sent (current variant = last variant sent)
INSERT INTO public.email_campaign_send_history (campaign_id, recipient_id, variant_sent, sent_at)
SELECT campaign_id, id, ab_variant, sent_at
FROM public.email_campaign_recipients
WHERE sent_at IS NOT NULL
  AND ab_variant IN ('A', 'B')
ON CONFLICT DO NOTHING;
