-- Run this in Supabase Dashboard → SQL Editor if Pause gives "violates check constraint email_campaigns_status_check"
-- This allows status = 'paused' so you can Pause → Edit → Resume without duplicates.

ALTER TABLE public.email_campaigns
  DROP CONSTRAINT IF EXISTS email_campaigns_status_check;

ALTER TABLE public.email_campaigns
  ADD CONSTRAINT email_campaigns_status_check
  CHECK (status IN ('draft', 'scheduled', 'sending', 'paused', 'completed', 'failed'));
