-- Optional per-newsletter header/logo image (overrides email branding for this send)
ALTER TABLE public.newsletters
  ADD COLUMN IF NOT EXISTS header_image_url TEXT DEFAULT NULL;

COMMENT ON COLUMN public.newsletters.header_image_url IS 'Optional custom header/logo URL for this newsletter; overrides sender profile / business logo in the email template.';

-- Optional per-series header image URLs (cycle through for daily editions so each day can look different)
ALTER TABLE public.newsletter_series
  ADD COLUMN IF NOT EXISTS header_image_urls JSONB DEFAULT NULL;

COMMENT ON COLUMN public.newsletter_series.header_image_urls IS 'Optional array of image URLs; each daily edition uses one (cycle by day index) so header varies per email.';
