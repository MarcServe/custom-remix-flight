-- Add industry to newsletter_subscribers for send-by-industry targeting.
-- Run in Supabase Dashboard → SQL Editor.
-- Safe to run (IF NOT EXISTS).

ALTER TABLE public.newsletter_subscribers
  ADD COLUMN IF NOT EXISTS industry TEXT;

COMMENT ON COLUMN public.newsletter_subscribers.industry IS 'Optional industry for segmenting (e.g. from company when imported from People)';
