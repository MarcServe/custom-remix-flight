-- Update teams SELECT policy to allow team members to view teams

DROP POLICY IF EXISTS "Users can view their own teams" ON public.teams;

CREATE POLICY "Team members can view teams"
ON public.teams
FOR SELECT
USING (
  auth.uid() = owner_id 
  OR public.has_team_membership(auth.uid(), id)
);