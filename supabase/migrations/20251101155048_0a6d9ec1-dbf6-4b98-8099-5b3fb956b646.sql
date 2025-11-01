-- Drop ALL existing policies on team_members to avoid recursion
DROP POLICY IF EXISTS "Team owners and admins can insert team_members" ON public.team_members;
DROP POLICY IF EXISTS "Team admins can manage team members" ON public.team_members;
DROP POLICY IF EXISTS "Team members can view team members" ON public.team_members;

-- Create simple, non-recursive policies
-- SELECT: Users can view members of teams they own
CREATE POLICY "Users can view team members of their teams"
ON public.team_members
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM teams WHERE id = team_members.team_id AND owner_id = auth.uid()
  )
);

-- INSERT: Team owners can add members
CREATE POLICY "Team owners can add members"
ON public.team_members
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM teams WHERE id = team_members.team_id AND owner_id = auth.uid()
  )
);

-- UPDATE: Team owners can update members
CREATE POLICY "Team owners can update members"
ON public.team_members
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM teams WHERE id = team_members.team_id AND owner_id = auth.uid()
  )
);

-- DELETE: Team owners can remove members
CREATE POLICY "Team owners can delete members"
ON public.team_members
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM teams WHERE id = team_members.team_id AND owner_id = auth.uid()
  )
);