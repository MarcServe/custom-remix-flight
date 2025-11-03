-- Recreate RLS policies that were dropped by CASCADE
-- teams policies
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'teams' AND policyname = 'Team members can view their teams'
  ) THEN
    CREATE POLICY "Team members can view their teams"
    ON public.teams FOR SELECT TO authenticated
    USING (has_team_membership(auth.uid(), id));
  END IF;
END $$;

-- team_members policies
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'team_members' AND policyname = 'Team members can view other team members'
  ) THEN
    CREATE POLICY "Team members can view other team members"
    ON public.team_members FOR SELECT TO authenticated
    USING (has_team_membership(auth.uid(), team_id));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'team_members' AND policyname = 'Team owners and admins can insert team_members'
  ) THEN
    CREATE POLICY "Team owners and admins can insert team_members"
    ON public.team_members FOR INSERT
    WITH CHECK (is_team_admin(auth.uid(), team_id) OR (auth.uid() = user_id AND role = 'owner'));
  END IF;
END $$;

-- team_invitations policies
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'team_invitations' AND policyname = 'Team members can view team invitations'
  ) THEN
    CREATE POLICY "Team members can view team invitations"
    ON public.team_invitations FOR SELECT
    USING (has_team_membership(auth.uid(), team_id));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'team_invitations' AND policyname = 'Team admins can create invitations'
  ) THEN
    CREATE POLICY "Team admins can create invitations"
    ON public.team_invitations FOR INSERT
    WITH CHECK (is_team_admin(auth.uid(), team_id) AND auth.uid() = invited_by_user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'team_invitations' AND policyname = 'Team admins can update invitations'
  ) THEN
    CREATE POLICY "Team admins can update invitations"
    ON public.team_invitations FOR UPDATE
    USING (is_team_admin(auth.uid(), team_id));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'team_invitations' AND policyname = 'Team admins can delete invitations'
  ) THEN
    CREATE POLICY "Team admins can delete invitations"
    ON public.team_invitations FOR DELETE
    USING (is_team_admin(auth.uid(), team_id));
  END IF;
END $$;

-- shared_inboxes policies
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'shared_inboxes' AND policyname = 'Team members can view shared_inboxes'
  ) THEN
    CREATE POLICY "Team members can view shared_inboxes"
    ON public.shared_inboxes FOR SELECT
    USING (has_team_membership(auth.uid(), team_id));
  END IF;
END $$;

-- assignment_rules policies
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'assignment_rules' AND policyname = 'Team members can view assignment rules'
  ) THEN
    CREATE POLICY "Team members can view assignment rules"
    ON public.assignment_rules FOR SELECT
    USING (has_team_membership(auth.uid(), team_id));
  END IF;
END $$;

-- assignments policies
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'assignments' AND policyname = 'Team members can view assignments'
  ) THEN
    CREATE POLICY "Team members can view assignments"
    ON public.assignments FOR SELECT
    USING (has_team_membership(auth.uid(), team_id));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'assignments' AND policyname = 'Team members can create assignments'
  ) THEN
    CREATE POLICY "Team members can create assignments"
    ON public.assignments FOR INSERT
    WITH CHECK (has_team_membership(auth.uid(), team_id) AND auth.uid() = assigned_by_user_id);
  END IF;
END $$;

-- internal_notes policies
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'internal_notes' AND policyname = 'Team members can view internal notes'
  ) THEN
    CREATE POLICY "Team members can view internal notes"
    ON public.internal_notes FOR SELECT
    USING (has_team_membership(auth.uid(), team_id));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'internal_notes' AND policyname = 'Team members can create internal notes'
  ) THEN
    CREATE POLICY "Team members can create internal notes"
    ON public.internal_notes FOR INSERT
    WITH CHECK (has_team_membership(auth.uid(), team_id) AND auth.uid() = author_id);
  END IF;
END $$;