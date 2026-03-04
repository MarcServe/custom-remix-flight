-- Newsletter series: recurring daily sends with AI-generated content (e.g. 7 or 30 days at 9:00 AM London)
CREATE TABLE IF NOT EXISTS public.newsletter_series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  duration_days INT NOT NULL CHECK (duration_days IN (7, 30)),
  send_time TEXT NOT NULL DEFAULT '09:00',
  timezone TEXT NOT NULL DEFAULT 'Europe/London',
  scheduled_send_options JSONB DEFAULT NULL,
  start_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
  ai_topic_template TEXT,
  ai_tone TEXT DEFAULT 'professional',
  ai_target_audience TEXT DEFAULT '',
  sender_profile_id UUID REFERENCES public.sender_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.newsletter_series_editions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id UUID NOT NULL REFERENCES public.newsletter_series(id) ON DELETE CASCADE,
  edition_date DATE NOT NULL,
  newsletter_id UUID NOT NULL REFERENCES public.newsletters(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(series_id, edition_date)
);

ALTER TABLE public.newsletter_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsletter_series_editions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own newsletter series" ON public.newsletter_series
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users manage own series editions" ON public.newsletter_series_editions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.newsletter_series s WHERE s.id = series_id AND s.user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_newsletter_series_user_status ON public.newsletter_series(user_id, status);
CREATE INDEX IF NOT EXISTS idx_newsletter_series_editions_series ON public.newsletter_series_editions(series_id);

COMMENT ON TABLE public.newsletter_series IS 'Recurring newsletter runs (e.g. 7 or 30 days) with daily AI-generated content at a set time (e.g. 9:00 AM London)';
COMMENT ON TABLE public.newsletter_series_editions IS 'One row per sent edition; links series to the newsletter row that was sent that day';
