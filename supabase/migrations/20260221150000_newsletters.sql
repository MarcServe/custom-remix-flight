-- Newsletter system tables

-- Categories for targeting specific industries/audiences
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
CREATE POLICY "Users manage own categories" ON public.newsletter_categories
  FOR ALL USING (auth.uid() = user_id);

-- Subscribers (can come from CRM or external signups)
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
CREATE POLICY "Users manage own subscribers" ON public.newsletter_subscribers
  FOR ALL USING (auth.uid() = user_id);
CREATE INDEX idx_newsletter_subscribers_email ON public.newsletter_subscribers(user_id, email);
CREATE INDEX idx_newsletter_subscribers_status ON public.newsletter_subscribers(user_id, status);

-- Subscriber category memberships (many-to-many)
CREATE TABLE IF NOT EXISTS public.newsletter_subscriber_categories (
  subscriber_id UUID NOT NULL REFERENCES public.newsletter_subscribers(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.newsletter_categories(id) ON DELETE CASCADE,
  PRIMARY KEY (subscriber_id, category_id)
);
ALTER TABLE public.newsletter_subscriber_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own subscriber categories" ON public.newsletter_subscriber_categories
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.newsletter_subscribers s WHERE s.id = subscriber_id AND s.user_id = auth.uid())
  );

-- Newsletters
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
CREATE POLICY "Users manage own newsletters" ON public.newsletters
  FOR ALL USING (auth.uid() = user_id);

-- Newsletter category targeting (many-to-many)
CREATE TABLE IF NOT EXISTS public.newsletter_target_categories (
  newsletter_id UUID NOT NULL REFERENCES public.newsletters(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.newsletter_categories(id) ON DELETE CASCADE,
  PRIMARY KEY (newsletter_id, category_id)
);
ALTER TABLE public.newsletter_target_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own newsletter targets" ON public.newsletter_target_categories
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.newsletters n WHERE n.id = newsletter_id AND n.user_id = auth.uid())
  );

-- Individual send records
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
CREATE POLICY "Users manage own newsletter sends" ON public.newsletter_sends
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.newsletters n WHERE n.id = newsletter_id AND n.user_id = auth.uid())
  );
CREATE INDEX idx_newsletter_sends_newsletter ON public.newsletter_sends(newsletter_id, status);
CREATE INDEX idx_newsletter_sends_subscriber ON public.newsletter_sends(subscriber_id);
