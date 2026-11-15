-- Audit 2026-11-15: three tables had USING (true) policies, letting any signed-in user read/change
-- every tenant's rows. Scope them to the owner (via the parent row) or the owner's team.

-- chat_conversations: owned through companies.user_id
DROP POLICY IF EXISTS "Authenticated users can view chat_conversations" ON public.chat_conversations;
DROP POLICY IF EXISTS "Authenticated users can insert chat_conversations" ON public.chat_conversations;
DROP POLICY IF EXISTS "Authenticated users can update chat_conversations" ON public.chat_conversations;
DROP POLICY IF EXISTS "Authenticated users can delete chat_conversations" ON public.chat_conversations;
CREATE POLICY "Owner can manage chat_conversations" ON public.chat_conversations
  FOR ALL TO authenticated
  USING (company_id IS NULL OR EXISTS (SELECT 1 FROM public.companies c WHERE c.id = chat_conversations.company_id AND c.user_id = auth.uid()))
  WITH CHECK (company_id IS NULL OR EXISTS (SELECT 1 FROM public.companies c WHERE c.id = chat_conversations.company_id AND c.user_id = auth.uid()));

-- deal_contacts: owned through deals.user_id
DROP POLICY IF EXISTS "Authenticated users can view deal_contacts" ON public.deal_contacts;
DROP POLICY IF EXISTS "Authenticated users can insert deal_contacts" ON public.deal_contacts;
DROP POLICY IF EXISTS "Authenticated users can delete deal_contacts" ON public.deal_contacts;
CREATE POLICY "Deal owner can manage deal_contacts" ON public.deal_contacts
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.deals d WHERE d.id = deal_contacts.deal_id AND d.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.deals d WHERE d.id = deal_contacts.deal_id AND d.user_id = auth.uid()));

-- profiles: own profile, or profiles of people on the same team (needed for assignment/team views)
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
CREATE POLICY "Users can view teammates' profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.team_members me
      JOIN public.team_members them ON them.team_id = me.team_id
      WHERE me.user_id = auth.uid() AND them.user_id = profiles.id
    )
  );
