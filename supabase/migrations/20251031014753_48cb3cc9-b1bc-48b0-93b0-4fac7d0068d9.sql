-- PHASE 1: Database & Schema Enhancement

-- ============================================================================
-- 1. Add enrichment columns to companies table
-- ============================================================================
ALTER TABLE companies 
  ADD COLUMN IF NOT EXISTS enrichment_data JSONB,
  ADD COLUMN IF NOT EXISTS enrichment_status TEXT DEFAULT 'pending';

-- enrichment_status values: 'pending', 'enriching', 'completed', 'failed'

COMMENT ON COLUMN companies.enrichment_data IS 'Structured enrichment data from Perplexity API including news, funding, tech stack, leadership, competitors';
COMMENT ON COLUMN companies.enrichment_status IS 'Status of enrichment: pending, enriching, completed, failed';
COMMENT ON COLUMN companies.enrichment_confidence IS 'Confidence score from 0.00 to 1.00 for enrichment data quality';

-- ============================================================================
-- 2. Create indexes for better query performance
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_companies_status ON companies(status);
CREATE INDEX IF NOT EXISTS idx_companies_created_at ON companies(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_companies_enrichment_status ON companies(enrichment_status);
CREATE INDEX IF NOT EXISTS idx_companies_website ON companies(website);
CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage);
CREATE INDEX IF NOT EXISTS idx_deals_company_id ON deals(company_id);
CREATE INDEX IF NOT EXISTS idx_people_company_id ON people(company_id);
CREATE INDEX IF NOT EXISTS idx_people_email ON people(email);
CREATE INDEX IF NOT EXISTS idx_events_company_id ON events(company_id);
CREATE INDEX IF NOT EXISTS idx_events_deal_id ON events(deal_id);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
CREATE INDEX IF NOT EXISTS idx_events_due_at ON events(due_at);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_company_id ON chat_conversations(company_id);

-- ============================================================================
-- 3. Create enums for company status and deal stage
-- ============================================================================
DO $$ BEGIN
    CREATE TYPE company_status AS ENUM (
        'NEW', 'QUALIFIED', 'CONTACTED', 
        'MEETING', 'PROPOSAL', 'WON', 'LOST'
    );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE deal_stage AS ENUM (
        'LEAD', 'QUALIFIED', 'PROPOSAL', 
        'NEGOTIATION', 'WON', 'LOST'
    );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- 4. Add foreign keys with cascade deletes
-- ============================================================================
ALTER TABLE people 
  DROP CONSTRAINT IF EXISTS people_company_id_fkey,
  ADD CONSTRAINT people_company_id_fkey 
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

ALTER TABLE deals
  DROP CONSTRAINT IF EXISTS deals_company_id_fkey,
  ADD CONSTRAINT deals_company_id_fkey
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

ALTER TABLE events
  DROP CONSTRAINT IF EXISTS events_company_id_fkey,
  ADD CONSTRAINT events_company_id_fkey
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

ALTER TABLE events
  DROP CONSTRAINT IF EXISTS events_deal_id_fkey,
  ADD CONSTRAINT events_deal_id_fkey
    FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE;

ALTER TABLE chat_conversations
  DROP CONSTRAINT IF EXISTS chat_conversations_company_id_fkey,
  ADD CONSTRAINT chat_conversations_company_id_fkey
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

-- ============================================================================
-- 5. Create/update updated_at triggers
-- ============================================================================
DROP TRIGGER IF EXISTS update_companies_updated_at ON companies;
CREATE TRIGGER update_companies_updated_at 
  BEFORE UPDATE ON companies
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_deals_updated_at ON deals;
CREATE TRIGGER update_deals_updated_at 
  BEFORE UPDATE ON deals
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_events_updated_at ON events;
CREATE TRIGGER update_events_updated_at 
  BEFORE UPDATE ON events
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 6. Create profiles table for authentication
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles RLS policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT 
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE 
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT 
  WITH CHECK (auth.uid() = id);

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User')
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_user();

-- Profiles updated_at trigger
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at 
  BEFORE UPDATE ON profiles
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 7. Enable real-time subscriptions for key tables
-- ============================================================================
ALTER TABLE companies REPLICA IDENTITY FULL;
ALTER TABLE deals REPLICA IDENTITY FULL;
ALTER TABLE events REPLICA IDENTITY FULL;

-- Note: Real-time publication configuration happens at the Supabase project level