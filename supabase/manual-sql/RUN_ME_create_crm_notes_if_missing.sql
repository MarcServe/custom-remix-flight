-- Run this in Supabase Dashboard → SQL Editor if Notes still can't save (table missing).
-- CRM Notes: save analysis results, campaign ideas, and snippets for use in campaigns
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
