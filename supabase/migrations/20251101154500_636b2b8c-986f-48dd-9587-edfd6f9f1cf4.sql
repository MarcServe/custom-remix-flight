-- Fix team_members INSERT policy to allow first member creation
-- The issue: when creating a new team, is_team_admin returns false because no members exist yet

DROP POLICY IF EXISTS "Team owners and admins can insert team_members" ON public.team_members;

-- New policy: Allow INSERT if user is admin OR if it's the first member of the team
CREATE POLICY "Team owners and admins can insert team_members"
ON public.team_members
FOR INSERT
WITH CHECK (
  -- Allow if user is already an admin/owner
  public.is_team_admin(auth.uid(), team_id)
  OR
  -- Allow if this is the first member (no members exist yet for this team)
  NOT EXISTS (
    SELECT 1 FROM public.team_members WHERE team_id = team_members.team_id
  )
);