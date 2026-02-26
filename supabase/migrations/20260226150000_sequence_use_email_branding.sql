-- Option for sequence emails to use the same email branding template as campaigns (logo, footer, style)
-- so recipients get a consistent look. Default true for consistency.
ALTER TABLE public.email_sequences
  ADD COLUMN IF NOT EXISTS use_email_branding boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.email_sequences.use_email_branding IS 'When true, sequence emails are wrapped in the business email template (logo, footer, style) so they match campaigns. When false, plain body only.';
