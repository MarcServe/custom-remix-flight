-- Run this in Supabase Dashboard > SQL Editor if sender_profiles table is missing.
-- Creates sender_profiles and related columns (idempotent).

-- 1. Create sender_profiles table
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

DROP POLICY IF EXISTS "Users can view own sender profiles" ON public.sender_profiles;
CREATE POLICY "Users can view own sender profiles"
  ON public.sender_profiles FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own sender profiles" ON public.sender_profiles;
CREATE POLICY "Users can insert own sender profiles"
  ON public.sender_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own sender profiles" ON public.sender_profiles;
CREATE POLICY "Users can update own sender profiles"
  ON public.sender_profiles FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own sender profiles" ON public.sender_profiles;
CREATE POLICY "Users can delete own sender profiles"
  ON public.sender_profiles FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_sender_profiles_user_id ON public.sender_profiles(user_id);

DROP TRIGGER IF EXISTS update_sender_profiles_updated_at ON public.sender_profiles;
CREATE TRIGGER update_sender_profiles_updated_at
  BEFORE UPDATE ON public.sender_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Add template_style if missing
ALTER TABLE public.sender_profiles
  ADD COLUMN IF NOT EXISTS template_style TEXT NOT NULL DEFAULT 'professional';

ALTER TABLE public.sender_profiles
  DROP CONSTRAINT IF EXISTS sender_profiles_template_style_check;

ALTER TABLE public.sender_profiles
  ADD CONSTRAINT sender_profiles_template_style_check
  CHECK (template_style IN (
    'professional', 'minimal', 'modern',
    'creative', 'corporate', 'bold', 'elegant'
  ));

-- 3. Link campaigns to sender profile (if email_campaigns exists)
ALTER TABLE public.email_campaigns
  ADD COLUMN IF NOT EXISTS sender_profile_id UUID REFERENCES public.sender_profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_email_campaigns_sender_profile_id ON public.email_campaigns(sender_profile_id);
