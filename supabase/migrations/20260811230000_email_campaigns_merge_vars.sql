-- Campaign-level merge variables (e.g. demoLink) for {{token}} substitution
ALTER TABLE public.email_campaigns
  ADD COLUMN IF NOT EXISTS merge_vars JSONB DEFAULT NULL;

COMMENT ON COLUMN public.email_campaigns.merge_vars IS
  'Optional JSON map of campaign-level merge tokens, e.g. {"demoLink":"https://example.com/demo"}.';
