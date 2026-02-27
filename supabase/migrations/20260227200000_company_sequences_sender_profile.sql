-- Allow sequence follow-ups (e.g. from campaign) to use the same sender profile as the campaign
-- so follow-up emails match the product branding (e.g. TALKWEB) used in the initial campaign.
ALTER TABLE public.company_sequences
  ADD COLUMN IF NOT EXISTS sender_profile_id uuid REFERENCES public.sender_profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.company_sequences.sender_profile_id IS 'When set (e.g. from campaign follow-up enrollment), sequence emails use this sender profile for branding instead of default business profile.';

CREATE INDEX IF NOT EXISTS idx_company_sequences_sender_profile
  ON public.company_sequences(sender_profile_id)
  WHERE sender_profile_id IS NOT NULL;
