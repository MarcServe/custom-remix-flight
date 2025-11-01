-- Fix Team and Shared Inbox RLS Policies
-- Remove overly restrictive policies and create simpler ones

-- ============================================
-- Fix team_members policies
-- ============================================

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Team members can view team_members" ON public.team_members;
DROP POLICY IF EXISTS "Team admins can insert team_members" ON public.team_members;
DROP POLICY IF EXISTS "Team admins can update team_members" ON public.team_members;
DROP POLICY IF EXISTS "Team admins can delete team_members" ON public.team_members;

-- Create simpler policies
-- Allow users to add themselves as team members (needed when creating teams)
CREATE POLICY "Users can add themselves as team members"
ON public.team_members
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Team admins can manage all members
CREATE POLICY "Team admins can manage members"
ON public.team_members
FOR ALL
USING (is_team_admin(auth.uid(), team_id));

-- Team members can view other members
CREATE POLICY "Team members can view members"
ON public.team_members
FOR SELECT
USING (has_team_membership(auth.uid(), team_id));

-- ============================================
-- Fix shared_inboxes policies
-- ============================================

-- Drop existing conflicting policies
DROP POLICY IF EXISTS "Team admins can manage shared inboxes" ON public.shared_inboxes;
DROP POLICY IF EXISTS "Team members can view shared inboxes" ON public.shared_inboxes;
DROP POLICY IF EXISTS "Users can view shared_inboxes from their teams" ON public.shared_inboxes;
DROP POLICY IF EXISTS "Users can view team shared inboxes" ON public.shared_inboxes;

-- Create simpler policies
-- Team members can view shared inboxes
CREATE POLICY "Team members can view shared inboxes"
ON public.shared_inboxes
FOR SELECT
USING (has_team_membership(auth.uid(), team_id));

-- Team admins can create shared inboxes
CREATE POLICY "Team admins can create shared inboxes"
ON public.shared_inboxes
FOR INSERT
WITH CHECK (is_team_admin(auth.uid(), team_id));

-- Team admins can update shared inboxes
CREATE POLICY "Team admins can update shared inboxes"
ON public.shared_inboxes
FOR UPDATE
USING (is_team_admin(auth.uid(), team_id));

-- Team admins can delete shared inboxes
CREATE POLICY "Team admins can delete shared inboxes"
ON public.shared_inboxes
FOR DELETE
USING (is_team_admin(auth.uid(), team_id));