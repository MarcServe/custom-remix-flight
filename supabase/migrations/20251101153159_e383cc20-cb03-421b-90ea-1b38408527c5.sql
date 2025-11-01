-- Create security definer functions to prevent RLS infinite recursion

-- Function to check if a user is a member of a team
CREATE OR REPLACE FUNCTION public.has_team_membership(_user_id uuid, _team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_members
    WHERE user_id = _user_id
      AND team_id = _team_id
  )
$$;

-- Function to get a user's role in a team
CREATE OR REPLACE FUNCTION public.get_user_team_role(_user_id uuid, _team_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.team_members
  WHERE user_id = _user_id
    AND team_id = _team_id
  LIMIT 1
$$;

-- Function to check if a user is an admin/owner of a team
CREATE OR REPLACE FUNCTION public.is_team_admin(_user_id uuid, _team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_members
    WHERE user_id = _user_id
      AND team_id = _team_id
      AND role IN ('owner', 'admin')
  )
$$;

-- Drop existing RLS policies on team_members to recreate them without circular dependencies
DROP POLICY IF EXISTS "Team members can view team_members" ON public.team_members;
DROP POLICY IF EXISTS "Team owners and admins can insert team_members" ON public.team_members;
DROP POLICY IF EXISTS "Team owners and admins can update team_members" ON public.team_members;
DROP POLICY IF EXISTS "Team owners and admins can delete team_members" ON public.team_members;

-- Recreate RLS policies on team_members using security definer functions
CREATE POLICY "Team members can view team_members"
ON public.team_members
FOR SELECT
USING (public.has_team_membership(auth.uid(), team_id));

CREATE POLICY "Team owners and admins can insert team_members"
ON public.team_members
FOR INSERT
WITH CHECK (public.is_team_admin(auth.uid(), team_id));

CREATE POLICY "Team owners and admins can update team_members"
ON public.team_members
FOR UPDATE
USING (public.is_team_admin(auth.uid(), team_id));

CREATE POLICY "Team owners and admins can delete team_members"
ON public.team_members
FOR DELETE
USING (public.is_team_admin(auth.uid(), team_id));

-- Update RLS policies on shared_inboxes
DROP POLICY IF EXISTS "Team members can view shared_inboxes" ON public.shared_inboxes;
DROP POLICY IF EXISTS "Team admins can manage shared_inboxes" ON public.shared_inboxes;

CREATE POLICY "Team members can view shared_inboxes"
ON public.shared_inboxes
FOR SELECT
USING (public.has_team_membership(auth.uid(), team_id));

CREATE POLICY "Team admins can manage shared_inboxes"
ON public.shared_inboxes
FOR ALL
USING (public.is_team_admin(auth.uid(), team_id));

-- Update RLS policies on assignment_rules
DROP POLICY IF EXISTS "Team members can view assignment rules" ON public.assignment_rules;
DROP POLICY IF EXISTS "Team admins can manage assignment rules" ON public.assignment_rules;

CREATE POLICY "Team members can view assignment rules"
ON public.assignment_rules
FOR SELECT
USING (public.has_team_membership(auth.uid(), team_id));

CREATE POLICY "Team admins can manage assignment rules"
ON public.assignment_rules
FOR ALL
USING (public.is_team_admin(auth.uid(), team_id));

-- Update RLS policies on assignments
DROP POLICY IF EXISTS "Team members can view assignments" ON public.assignments;
DROP POLICY IF EXISTS "Team members can create assignments" ON public.assignments;
DROP POLICY IF EXISTS "Assigned users can update their assignments" ON public.assignments;
DROP POLICY IF EXISTS "Team admins or assigners can delete assignments" ON public.assignments;

CREATE POLICY "Team members can view assignments"
ON public.assignments
FOR SELECT
USING (public.has_team_membership(auth.uid(), team_id));

CREATE POLICY "Team members can create assignments"
ON public.assignments
FOR INSERT
WITH CHECK (
  public.has_team_membership(auth.uid(), team_id)
  AND auth.uid() = assigned_by_user_id
);

CREATE POLICY "Assigned users can update their assignments"
ON public.assignments
FOR UPDATE
USING (
  auth.uid() = assigned_to_user_id
  OR auth.uid() = assigned_by_user_id
  OR public.is_team_admin(auth.uid(), team_id)
);

CREATE POLICY "Team admins or assigners can delete assignments"
ON public.assignments
FOR DELETE
USING (
  auth.uid() = assigned_by_user_id
  OR public.is_team_admin(auth.uid(), team_id)
);

-- Update RLS policies on internal_notes
DROP POLICY IF EXISTS "Team members can view internal notes" ON public.internal_notes;
DROP POLICY IF EXISTS "Team members can create internal notes" ON public.internal_notes;
DROP POLICY IF EXISTS "Note authors can update their notes" ON public.internal_notes;
DROP POLICY IF EXISTS "Note authors or admins can delete notes" ON public.internal_notes;

CREATE POLICY "Team members can view internal notes"
ON public.internal_notes
FOR SELECT
USING (public.has_team_membership(auth.uid(), team_id));

CREATE POLICY "Team members can create internal notes"
ON public.internal_notes
FOR INSERT
WITH CHECK (
  public.has_team_membership(auth.uid(), team_id)
  AND auth.uid() = author_id
);

CREATE POLICY "Note authors can update their notes"
ON public.internal_notes
FOR UPDATE
USING (auth.uid() = author_id);

CREATE POLICY "Note authors or admins can delete notes"
ON public.internal_notes
FOR DELETE
USING (
  auth.uid() = author_id
  OR public.is_team_admin(auth.uid(), team_id)
);