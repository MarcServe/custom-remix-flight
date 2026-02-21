-- Auto follow-up for campaigns: when enabled, recipients are enrolled in a follow-up sequence
-- so reminders can be sent automatically when there is no response (via process-sequence-steps).

-- Add follow-up settings to email_campaigns
ALTER TABLE public.email_campaigns
  ADD COLUMN IF NOT EXISTS auto_follow_up_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS follow_up_sequence_id uuid REFERENCES public.email_sequences(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.email_campaigns.auto_follow_up_enabled IS 'When true, recipients are enrolled in the follow-up sequence for no-reply reminders';
COMMENT ON COLUMN public.email_campaigns.follow_up_sequence_id IS 'Sequence to use for follow-up reminders when no response (uses process-sequence-steps rules)';

-- Link company_sequences to a campaign when created from campaign follow-up
ALTER TABLE public.company_sequences
  ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES public.email_campaigns(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.company_sequences.campaign_id IS 'Set when this sequence was started from a campaign send (for auto follow-up reminders)';

-- One follow-up enrollment per campaign per company
CREATE UNIQUE INDEX IF NOT EXISTS idx_company_sequences_campaign_company
  ON public.company_sequences (campaign_id, company_id)
  WHERE campaign_id IS NOT NULL;

-- Optional: default follow-up sequence for all new campaigns (business_profiles)
ALTER TABLE public.business_profiles
  ADD COLUMN IF NOT EXISTS default_follow_up_sequence_id uuid REFERENCES public.email_sequences(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.business_profiles.default_follow_up_sequence_id IS 'Default sequence used for campaign auto follow-up when not set per campaign';
