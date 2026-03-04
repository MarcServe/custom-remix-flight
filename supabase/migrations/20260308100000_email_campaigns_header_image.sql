-- Optional per-campaign header/logo image (overrides email branding for this campaign)
ALTER TABLE public.email_campaigns
  ADD COLUMN IF NOT EXISTS header_image_url TEXT DEFAULT NULL;

COMMENT ON COLUMN public.email_campaigns.header_image_url IS 'Optional custom header/logo URL for this campaign; overrides sender profile / business logo in the email template.';
