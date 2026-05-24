-- Consolidated from all RUN_ME_*.sql files (previously skipped by Supabase CLI due to non-standard naming)

-- =============================================================================
-- SECTION 1: sender_profiles table (must come first — other sections reference it)
-- =============================================================================

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

-- sender_profiles: template_style
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

-- sender_profiles: branding & identity columns
ALTER TABLE public.sender_profiles ADD COLUMN IF NOT EXISTS footer_image_url TEXT;
ALTER TABLE public.sender_profiles ADD COLUMN IF NOT EXISTS footer_logo_url TEXT;
ALTER TABLE public.sender_profiles ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE public.sender_profiles ADD COLUMN IF NOT EXISTS sender_name TEXT;
ALTER TABLE public.sender_profiles ADD COLUMN IF NOT EXISTS sender_email TEXT;
ALTER TABLE public.sender_profiles ADD COLUMN IF NOT EXISTS sender_title TEXT;
ALTER TABLE public.sender_profiles ADD COLUMN IF NOT EXISTS sender_image_url TEXT;
ALTER TABLE public.sender_profiles ADD COLUMN IF NOT EXISTS website_url TEXT;
ALTER TABLE public.sender_profiles ADD COLUMN IF NOT EXISTS signature_closing TEXT;
ALTER TABLE public.sender_profiles ADD COLUMN IF NOT EXISTS sender_phone TEXT;
ALTER TABLE public.sender_profiles ADD COLUMN IF NOT EXISTS sender_address TEXT;
ALTER TABLE public.sender_profiles ADD COLUMN IF NOT EXISTS signature_use_structured BOOLEAN DEFAULT true;
ALTER TABLE public.sender_profiles ADD COLUMN IF NOT EXISTS signature_company TEXT;

COMMENT ON COLUMN public.sender_profiles.display_name IS 'Brand / company name shown in email headers. When null, falls back to business_profiles.company_name. The "name" column is for internal identification only.';
COMMENT ON COLUMN public.sender_profiles.sender_image_url IS 'Circular image shown in the email signature next to the sender name. Falls back to profiles.avatar_url when null.';

-- =============================================================================
-- SECTION 2: business_profiles columns
-- =============================================================================

ALTER TABLE public.business_profiles ADD COLUMN IF NOT EXISTS email_logo_url TEXT;
ALTER TABLE public.business_profiles ADD COLUMN IF NOT EXISTS email_brand_color TEXT DEFAULT '#8b5cf6';
ALTER TABLE public.business_profiles ADD COLUMN IF NOT EXISTS email_footer_text TEXT;
ALTER TABLE public.business_profiles ADD COLUMN IF NOT EXISTS email_signature TEXT;
ALTER TABLE public.business_profiles ADD COLUMN IF NOT EXISTS email_template_style TEXT DEFAULT 'professional';
ALTER TABLE public.business_profiles ADD COLUMN IF NOT EXISTS email_footer_image_url TEXT;
ALTER TABLE public.business_profiles ADD COLUMN IF NOT EXISTS email_footer_logo_url TEXT;
ALTER TABLE public.business_profiles ADD COLUMN IF NOT EXISTS email_header_name TEXT;
ALTER TABLE public.business_profiles ADD COLUMN IF NOT EXISTS email_sender_image_url TEXT;
ALTER TABLE public.business_profiles ADD COLUMN IF NOT EXISTS email_sender_name TEXT;
ALTER TABLE public.business_profiles ADD COLUMN IF NOT EXISTS email_sender_title TEXT;
ALTER TABLE public.business_profiles ADD COLUMN IF NOT EXISTS email_sender_email TEXT;
ALTER TABLE public.business_profiles ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE public.business_profiles ADD COLUMN IF NOT EXISTS email_signature_closing TEXT;
ALTER TABLE public.business_profiles ADD COLUMN IF NOT EXISTS email_sender_phone TEXT;
ALTER TABLE public.business_profiles ADD COLUMN IF NOT EXISTS email_sender_address TEXT;
ALTER TABLE public.business_profiles ADD COLUMN IF NOT EXISTS email_signature_use_structured BOOLEAN DEFAULT true;
ALTER TABLE public.business_profiles ADD COLUMN IF NOT EXISTS default_follow_up_sequence_id uuid REFERENCES public.email_sequences(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.business_profiles.email_header_name IS 'Brand name shown in the email header. When null, no name appears in the header. Separate from company_name used in the CRM.';

-- =============================================================================
-- SECTION 3: profiles columns
-- =============================================================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- =============================================================================
-- SECTION 4: email_campaigns columns & constraints
-- =============================================================================

-- Allow 'paused' status
ALTER TABLE public.email_campaigns
  DROP CONSTRAINT IF EXISTS email_campaigns_status_check;

ALTER TABLE public.email_campaigns
  ADD CONSTRAINT email_campaigns_status_check
  CHECK (status IN ('draft', 'scheduled', 'sending', 'paused', 'completed', 'failed'));

-- Follow-up columns
ALTER TABLE public.email_campaigns
  ADD COLUMN IF NOT EXISTS auto_follow_up_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS follow_up_sequence_id uuid REFERENCES public.email_sequences(id) ON DELETE SET NULL;

-- Sender profile link
ALTER TABLE public.email_campaigns
  ADD COLUMN IF NOT EXISTS sender_profile_id UUID REFERENCES public.sender_profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_email_campaigns_sender_profile_id ON public.email_campaigns(sender_profile_id);

-- =============================================================================
-- SECTION 5: company_sequences columns
-- =============================================================================

ALTER TABLE public.company_sequences
  ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES public.email_campaigns(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_company_sequences_campaign_company
  ON public.company_sequences (campaign_id, company_id)
  WHERE campaign_id IS NOT NULL;

-- =============================================================================
-- SECTION 6: email_sequences repeat columns
-- =============================================================================

ALTER TABLE email_sequences
  ADD COLUMN IF NOT EXISTS repeat_sequence boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS repeat_after_days integer NOT NULL DEFAULT 5;

ALTER TABLE email_sequences
  ADD COLUMN IF NOT EXISTS repeat_only_for text NOT NULL DEFAULT 'no_reply';

COMMENT ON COLUMN email_sequences.repeat_sequence IS 'When true, after the sequence completes it restarts after repeat_after_days.';
COMMENT ON COLUMN email_sequences.repeat_after_days IS 'Days to wait after completion before restarting the sequence (used when repeat_sequence is true).';
COMMENT ON COLUMN email_sequences.repeat_only_for IS 'When repeating: all | not_opened | opened_not_clicked | clicked_not_replied | no_reply. Only restart for contacts matching this.';

-- =============================================================================
-- SECTION 7: crm_connections — allow multiple Resend/SendGrid senders per account
-- =============================================================================

ALTER TABLE public.crm_connections
  DROP CONSTRAINT IF EXISTS crm_connections_user_id_provider_key;

-- =============================================================================
-- SECTION 8: newsletter system tables
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.newsletter_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#8b5cf6',
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.newsletter_categories ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users manage own categories" ON public.newsletter_categories FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  company TEXT,
  source TEXT DEFAULT 'manual',
  status TEXT DEFAULT 'active' CHECK (status IN ('active','unsubscribed','bounced')),
  unsubscribe_token UUID DEFAULT gen_random_uuid(),
  unsubscribed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, email)
);
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users manage own subscribers" ON public.newsletter_subscribers FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_email ON public.newsletter_subscribers(user_id, email);
CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_status ON public.newsletter_subscribers(user_id, status);

-- newsletter_subscribers: industry column for targeting
ALTER TABLE public.newsletter_subscribers
  ADD COLUMN IF NOT EXISTS industry TEXT;

COMMENT ON COLUMN public.newsletter_subscribers.industry IS 'Optional industry for segmenting (e.g. from company when imported from People)';

CREATE TABLE IF NOT EXISTS public.newsletter_subscriber_categories (
  subscriber_id UUID NOT NULL REFERENCES public.newsletter_subscribers(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.newsletter_categories(id) ON DELETE CASCADE,
  PRIMARY KEY (subscriber_id, category_id)
);
ALTER TABLE public.newsletter_subscriber_categories ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users manage own subscriber categories" ON public.newsletter_subscriber_categories
    FOR ALL USING (EXISTS (SELECT 1 FROM public.newsletter_subscribers s WHERE s.id = subscriber_id AND s.user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.newsletters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled Newsletter',
  subject TEXT NOT NULL DEFAULT '',
  body_html TEXT DEFAULT '',
  body_json JSONB,
  cta_text TEXT,
  cta_url TEXT,
  sender_profile_id UUID REFERENCES public.sender_profiles(id) ON DELETE SET NULL,
  template_style TEXT DEFAULT 'professional',
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','scheduled','sending','sent','cancelled')),
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  total_recipients INT DEFAULT 0,
  total_sent INT DEFAULT 0,
  total_opened INT DEFAULT 0,
  total_clicked INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.newsletters ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users manage own newsletters" ON public.newsletters FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.newsletter_target_categories (
  newsletter_id UUID NOT NULL REFERENCES public.newsletters(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.newsletter_categories(id) ON DELETE CASCADE,
  PRIMARY KEY (newsletter_id, category_id)
);
ALTER TABLE public.newsletter_target_categories ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users manage own newsletter targets" ON public.newsletter_target_categories
    FOR ALL USING (EXISTS (SELECT 1 FROM public.newsletters n WHERE n.id = newsletter_id AND n.user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.newsletter_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  newsletter_id UUID NOT NULL REFERENCES public.newsletters(id) ON DELETE CASCADE,
  subscriber_id UUID NOT NULL REFERENCES public.newsletter_subscribers(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','opened','clicked','bounced')),
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.newsletter_sends ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users manage own newsletter sends" ON public.newsletter_sends
    FOR ALL USING (EXISTS (SELECT 1 FROM public.newsletters n WHERE n.id = newsletter_id AND n.user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS idx_newsletter_sends_newsletter ON public.newsletter_sends(newsletter_id, status);
CREATE INDEX IF NOT EXISTS idx_newsletter_sends_subscriber ON public.newsletter_sends(subscriber_id);

-- =============================================================================
-- SECTION 9: recipient_groups tables
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.recipient_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.recipient_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.recipient_groups(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  company TEXT,
  person_id UUID REFERENCES public.people(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(group_id, email)
);

ALTER TABLE public.recipient_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipient_group_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own recipient groups" ON public.recipient_groups;
CREATE POLICY "Users can manage own recipient groups"
  ON public.recipient_groups FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage members of own groups" ON public.recipient_group_members;
CREATE POLICY "Users can manage members of own groups"
  ON public.recipient_group_members FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.recipient_groups g WHERE g.id = group_id AND g.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.recipient_groups g WHERE g.id = group_id AND g.user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_recipient_groups_user_id ON public.recipient_groups(user_id);
CREATE INDEX IF NOT EXISTS idx_recipient_group_members_group_id ON public.recipient_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_recipient_group_members_email ON public.recipient_group_members(group_id, email);

COMMENT ON TABLE public.recipient_groups IS 'Saved recipient lists from campaigns; reusable for new campaigns and newsletter grouping';
COMMENT ON TABLE public.recipient_group_members IS 'Members of a recipient group (email + optional person_id, name, company)';

-- =============================================================================
-- SECTION 10: crm_notes table
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.crm_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled note',
  content TEXT NOT NULL DEFAULT '',
  source TEXT,
  source_metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_notes_user_id ON public.crm_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_crm_notes_updated_at ON public.crm_notes(updated_at DESC);

ALTER TABLE public.crm_notes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_notes' AND policyname = 'Users can view own crm_notes') THEN
    CREATE POLICY "Users can view own crm_notes" ON public.crm_notes FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_notes' AND policyname = 'Users can insert own crm_notes') THEN
    CREATE POLICY "Users can insert own crm_notes" ON public.crm_notes FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_notes' AND policyname = 'Users can update own crm_notes') THEN
    CREATE POLICY "Users can update own crm_notes" ON public.crm_notes FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_notes' AND policyname = 'Users can delete own crm_notes') THEN
    CREATE POLICY "Users can delete own crm_notes" ON public.crm_notes FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

COMMENT ON TABLE public.crm_notes IS 'Saved notes and analysis snippets for use in campaigns and CRM';
