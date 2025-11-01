
-- Fix infinite recursion in team_members by removing duplicate policies
-- Keep only the policies that use security definer functions

-- DROP duplicate/problematic INSERT policies
DROP POLICY IF EXISTS "Team admins can add members" ON public.team_members;
DROP POLICY IF EXISTS "Team owners can add members" ON public.team_members;

-- DROP duplicate/problematic SELECT policies  
DROP POLICY IF EXISTS "Team members can view other members" ON public.team_members;
DROP POLICY IF EXISTS "Users can view team members of their teams" ON public.team_members;

-- DROP duplicate UPDATE policies
DROP POLICY IF EXISTS "Team admins can update members" ON public.team_members;
DROP POLICY IF EXISTS "Team owners can update members" ON public.team_members;

-- DROP duplicate DELETE policies
DROP POLICY IF EXISTS "Team admins can remove members" ON public.team_members;
DROP POLICY IF EXISTS "Team owners can delete members" ON public.team_members;

-- CREATE proper UPDATE policy using security definer function
CREATE POLICY "Team admins can update team_members"
ON public.team_members
FOR UPDATE
USING (public.is_team_admin(auth.uid(), team_id));

-- CREATE proper DELETE policy using security definer function
CREATE POLICY "Team admins can delete team_members"
ON public.team_members
FOR DELETE
USING (public.is_team_admin(auth.uid(), team_id));

-- Fix profiles RLS to allow viewing other users' basic info (needed for invites)
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

CREATE POLICY "Users can view all profiles"
ON public.profiles
FOR SELECT
USING (true);  -- Allow viewing all profiles for team collaboration

-- Keep the update/insert policies restricted to own profile
-- (These should already exist, just confirming)
