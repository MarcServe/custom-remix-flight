-- Richer business knowledge learned from the company's website (or pasted in),
-- used as grounding for every AI-written email, text, newsletter and automation.
ALTER TABLE public.business_profiles
  ADD COLUMN IF NOT EXISTS knowledge_base text,
  ADD COLUMN IF NOT EXISTS website_learned_at timestamptz,
  ADD COLUMN IF NOT EXISTS learned_from_url text;

COMMENT ON COLUMN public.business_profiles.knowledge_base IS
  'Facts about the business (offerings, pricing, USPs, locations, proof points, FAQs) in plain text; grounding for AI copy. Filled by learn-business or edited by hand.';
