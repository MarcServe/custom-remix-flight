-- Allow 'paused' status so users can pause a sending campaign, edit (e.g. add image), then resume without duplicates
ALTER TABLE public.email_campaigns
  DROP CONSTRAINT IF EXISTS email_campaigns_status_check;

ALTER TABLE public.email_campaigns
  ADD CONSTRAINT email_campaigns_status_check
  CHECK (status IN ('draft', 'scheduled', 'sending', 'paused', 'completed', 'failed'));

COMMENT ON COLUMN public.email_campaigns.status IS 'paused = temporarily stopped; cron only processes sending. Resume to continue from pending.';
