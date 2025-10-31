-- Create business_profiles table to store user's business information for AI personalization
CREATE TABLE IF NOT EXISTS public.business_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  company_name TEXT,
  industry TEXT,
  services_description TEXT NOT NULL, -- What the user's company does/offers
  target_audience TEXT, -- Who they typically sell to
  value_proposition TEXT, -- Key differentiators
  tone_preference TEXT DEFAULT 'professional', -- preferred email tone
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.business_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for business_profiles
CREATE POLICY "Users can view their own business profile"
ON public.business_profiles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own business profile"
ON public.business_profiles FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own business profile"
ON public.business_profiles FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own business profile"
ON public.business_profiles FOR DELETE
USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_business_profiles_updated_at
BEFORE UPDATE ON public.business_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();