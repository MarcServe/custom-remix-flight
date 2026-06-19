-- Run this in Supabase Dashboard > SQL Editor if you get errors when:
-- - Saving draft (Send Bulk Email): "auto_follow_up_enabled column of email_campaigns"
-- - Saving profile / sender profile: "column ... in the schema cache"
-- Run the whole script once; it is idempotent.
-- If sender_profiles table is missing, run RUN_ME_sender_profiles_if_missing.sql first.

-- 1. email_campaigns: required for "Save Draft"
ALTER TABLE public.email_campaigns
  ADD COLUMN IF NOT EXISTS auto_follow_up_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS follow_up_sequence_id uuid REFERENCES public.email_sequences(id) ON DELETE SET NULL;

-- 2. company_sequences + business_profiles
ALTER TABLE public.company_sequences
  ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES public.email_campaigns(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_company_sequences_campaign_company
  ON public.company_sequences (campaign_id, company_id)
  WHERE campaign_id IS NOT NULL;

ALTER TABLE public.business_profiles
  ADD COLUMN IF NOT EXISTS default_follow_up_sequence_id uuid REFERENCES public.email_sequences(id) ON DELETE SET NULL;

-- 3. sender_profiles: template_style (if table exists but column missing)
ALTER TABLE public.sender_profiles
  ADD COLUMN IF NOT EXISTS template_style TEXT NOT NULL DEFAULT 'professional';

ALTER TABLE public.sender_profiles
  DROP CONSTRAINT IF EXISTS sender_profiles_template_style_check;

ALTER TABLE public.sender_profiles
  ADD CONSTRAINT sender_profiles_template_style_check
  CHECK (template_style IN (
    'professional', 'minimal', 'modern',
    'creative', 'corporate', 'bold', 'elegant'
  ));

-- 4. email_campaigns link to sender profile (if missing)
ALTER TABLE public.email_campaigns
  ADD COLUMN IF NOT EXISTS sender_profile_id UUID REFERENCES public.sender_profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_email_campaigns_sender_profile_id ON public.email_campaigns(sender_profile_id);
