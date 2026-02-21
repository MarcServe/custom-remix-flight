-- Per-product/sub-profile email template style (professional, minimal, modern)
ALTER TABLE public.sender_profiles
  ADD COLUMN IF NOT EXISTS template_style TEXT NOT NULL DEFAULT 'professional'
  CHECK (template_style IN ('professional', 'minimal', 'modern'));

COMMENT ON COLUMN public.sender_profiles.template_style IS 'Email template style for this sender profile (product/brand).';
