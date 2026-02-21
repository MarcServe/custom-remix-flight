-- Recipient groups: save campaign recipients for reuse in campaigns and newsletter grouping
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
