-- Allow long-running daily newsletter series (e.g. 365 days or "ongoing" multi-year)
ALTER TABLE public.newsletter_series
  DROP CONSTRAINT IF EXISTS newsletter_series_duration_days_check;

ALTER TABLE public.newsletter_series
  ADD CONSTRAINT newsletter_series_duration_days_check
  CHECK (duration_days >= 1 AND duration_days <= 99999);

COMMENT ON CONSTRAINT newsletter_series_duration_days_check ON public.newsletter_series IS
  'Series length in days; use large values (e.g. 9999) for effectively ongoing daily sends until paused or completed.';
