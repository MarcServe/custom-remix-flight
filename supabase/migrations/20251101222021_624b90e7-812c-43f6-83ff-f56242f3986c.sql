-- Add missing SELECT policy for teams table
-- Users should be able to view teams they own

CREATE POLICY "Users can view teams they own"
ON public.teams
FOR SELECT
USING (owner_id = auth.uid());