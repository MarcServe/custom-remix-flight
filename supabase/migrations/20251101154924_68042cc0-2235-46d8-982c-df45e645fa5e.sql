-- Fix team_members INSERT policy - avoid recursion by checking team ownership instead

DROP POLICY IF EXISTS "Team owners and admins can insert team_members" ON public.team_members;

-- New policy: Allow INSERT based on team ownership, not team membership
CREATE POLICY "Team owners and admins can insert team_members"
ON public.team_members
FOR INSERT
WITH CHECK (
  -- Allow if the user owns the team (no recursion - just checks teams table)
  EXISTS (
    SELECT 1 FROM teams WHERE id = team_members.team_id AND owner_id = auth.uid()
  )
  OR
  -- Allow if this is the first member being added (no existing members)
  NOT EXISTS (
    SELECT 1 FROM team_members tm WHERE tm.team_id = team_members.team_id
  )
);