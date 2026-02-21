-- Sender profiles: multiple sending identities per user (e.g. TALKWEB, Biz Boosters)
-- Used for "Send as" in bulk/CRM emails so each can have its own name and logo.
CREATE TABLE IF NOT EXISTS public.sender_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  logo_url TEXT,
  brand_color TEXT DEFAULT '#8b5cf6',
  footer_text TEXT,
  signature TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.sender_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sender profiles"
  ON public.sender_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sender profiles"
  ON public.sender_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sender profiles"
  ON public.sender_profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sender profiles"
  ON public.sender_profiles FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_sender_profiles_user_id ON public.sender_profiles(user_id);

CREATE TRIGGER update_sender_profiles_updated_at
  BEFORE UPDATE ON public.sender_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Allow campaigns to use a specific sender profile (null = use main business profile)
ALTER TABLE public.email_campaigns
  ADD COLUMN IF NOT EXISTS sender_profile_id UUID REFERENCES public.sender_profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_email_campaigns_sender_profile_id ON public.email_campaigns(sender_profile_id);

COMMENT ON TABLE public.sender_profiles IS 'Per-user sending identities (name + logo) for bulk/CRM emails';
COMMENT ON COLUMN public.email_campaigns.sender_profile_id IS 'When set, use this profile for sender name/logo; otherwise use business_profiles';
