-- Run this in Supabase Dashboard > SQL Editor if "Save Draft" fails with
-- "Could not find the 'auto_follow_up_enabled' column of 'email_campaigns' in the schema cache."

-- Add follow-up settings to email_campaigns
ALTER TABLE public.email_campaigns
  ADD COLUMN IF NOT EXISTS auto_follow_up_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS follow_up_sequence_id uuid REFERENCES public.email_sequences(id) ON DELETE SET NULL;

-- Link company_sequences to a campaign when created from campaign follow-up
ALTER TABLE public.company_sequences
  ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES public.email_campaigns(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_company_sequences_campaign_company
  ON public.company_sequences (campaign_id, company_id)
  WHERE campaign_id IS NOT NULL;

-- Optional: default follow-up sequence for business_profiles
ALTER TABLE public.business_profiles
  ADD COLUMN IF NOT EXISTS default_follow_up_sequence_id uuid REFERENCES public.email_sequences(id) ON DELETE SET NULL;
