-- Schedule Resend/Swap A/B actions for a future time (used from A/B Testing → Schedule tab)
CREATE TABLE IF NOT EXISTS public.scheduled_campaign_actions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES email_campaigns(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('swap', 'resend_a', 'resend_b', 'resend_all')),
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_campaign_actions_due
  ON public.scheduled_campaign_actions(scheduled_at)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_scheduled_campaign_actions_user
  ON public.scheduled_campaign_actions(user_id);

ALTER TABLE public.scheduled_campaign_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own scheduled actions"
ON public.scheduled_campaign_actions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own scheduled actions"
ON public.scheduled_campaign_actions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own scheduled actions"
ON public.scheduled_campaign_actions FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own scheduled actions"
ON public.scheduled_campaign_actions FOR DELETE
USING (auth.uid() = user_id);

COMMENT ON TABLE public.scheduled_campaign_actions IS 'Scheduled Resend/Swap A/B actions; cron processes due rows and invokes resend + send-bulk-emails.';
