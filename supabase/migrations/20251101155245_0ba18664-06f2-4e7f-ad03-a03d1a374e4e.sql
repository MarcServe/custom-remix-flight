-- Drop existing recursive policies on teams
DROP POLICY IF EXISTS "Team members can view their teams" ON public.teams;
DROP POLICY IF EXISTS "Team admins can update teams" ON public.teams;
DROP POLICY IF EXISTS "Team owners can create teams" ON public.teams;
DROP POLICY IF EXISTS "Team owners can delete teams" ON public.teams;

-- Create simple, non-recursive policies for teams
-- SELECT: Users can view teams they own
CREATE POLICY "Users can view their own teams"
ON public.teams
FOR SELECT
USING (owner_id = auth.uid());

-- INSERT: Any authenticated user can create a team (they must be the owner)
CREATE POLICY "Users can create teams as owner"
ON public.teams
FOR INSERT
WITH CHECK (owner_id = auth.uid());

-- UPDATE: Only team owner can update
CREATE POLICY "Team owners can update their teams"
ON public.teams
FOR UPDATE
USING (owner_id = auth.uid());

-- DELETE: Only team owner can delete
CREATE POLICY "Team owners can delete their teams"
ON public.teams
FOR DELETE
USING (owner_id = auth.uid());