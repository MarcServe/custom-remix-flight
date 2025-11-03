-- Add missing RLS policies for shared_inboxes
-- The table currently only has SELECT policy, but needs INSERT, UPDATE, DELETE policies

-- Drop and recreate the policies to ensure they're correct
DROP POLICY IF EXISTS "Team admins can manage shared_inboxes" ON public.shared_inboxes;

-- Create comprehensive policies for shared_inboxes
CREATE POLICY "Team admins can insert shared_inboxes"
ON public.shared_inboxes
FOR INSERT
WITH CHECK (public.is_team_admin(auth.uid(), team_id));

CREATE POLICY "Team admins can update shared_inboxes"
ON public.shared_inboxes
FOR UPDATE
USING (public.is_team_admin(auth.uid(), team_id));

CREATE POLICY "Team admins can delete shared_inboxes"
ON public.shared_inboxes
FOR DELETE
USING (public.is_team_admin(auth.uid(), team_id));