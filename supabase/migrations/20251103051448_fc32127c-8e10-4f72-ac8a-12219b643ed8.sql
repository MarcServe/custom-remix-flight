-- Part 1: Fix Team Visibility - Allow team members to view their teams
CREATE POLICY "Team members can view their teams"
ON public.teams
FOR SELECT
TO authenticated
USING (has_team_membership(auth.uid(), id));

-- Part 2: Add policy for team members to view team members
CREATE POLICY "Team members can view other team members"
ON public.team_members
FOR SELECT
TO authenticated
USING (has_team_membership(auth.uid(), team_id));

-- Part 3: Clean up duplicate RLS policy on shared_inboxes
DROP POLICY IF EXISTS "Team members can view shared_inboxes" ON public.shared_inboxes;

-- Part 4: Add missing indexes for performance
CREATE INDEX IF NOT EXISTS idx_team_members_user_team ON public.team_members(user_id, team_id);
CREATE INDEX IF NOT EXISTS idx_team_invitations_email ON public.team_invitations(email) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_team_invitations_token ON public.team_invitations(token) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_assignments_assigned_to ON public.assignments(assigned_to_user_id, status);