-- Fix infinite recursion in team security functions by using PL/pgSQL with RLS bypass

-- Drop and recreate has_team_membership with RLS bypass (CASCADE to drop dependent policies)
DROP FUNCTION IF EXISTS public.has_team_membership(uuid, uuid) CASCADE;

CREATE OR REPLACE FUNCTION public.has_team_membership(_user_id uuid, _team_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result boolean;
BEGIN
  -- Bypass RLS to prevent infinite recursion when RLS policies call this function
  SET LOCAL row_security = off;
  
  SELECT EXISTS (
    SELECT 1
    FROM public.team_members
    WHERE user_id = _user_id
      AND team_id = _team_id
  ) INTO result;
  
  RETURN result;
END;
$$;

-- Drop and recreate is_team_admin with RLS bypass (CASCADE to drop dependent policies)
DROP FUNCTION IF EXISTS public.is_team_admin(uuid, uuid) CASCADE;

CREATE OR REPLACE FUNCTION public.is_team_admin(_user_id uuid, _team_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result boolean;
BEGIN
  -- Bypass RLS to prevent infinite recursion when RLS policies call this function
  SET LOCAL row_security = off;
  
  SELECT EXISTS (
    SELECT 1
    FROM public.team_members
    WHERE user_id = _user_id
      AND team_id = _team_id
      AND role IN ('owner', 'admin')
  ) INTO result;
  
  RETURN result;
END;
$$;

-- Drop and recreate get_user_team_role with RLS bypass (CASCADE to drop dependent policies)
DROP FUNCTION IF EXISTS public.get_user_team_role(uuid, uuid) CASCADE;

CREATE OR REPLACE FUNCTION public.get_user_team_role(_user_id uuid, _team_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role text;
BEGIN
  -- Bypass RLS to prevent infinite recursion when RLS policies call this function
  SET LOCAL row_security = off;
  
  SELECT role
  FROM public.team_members
  WHERE user_id = _user_id
    AND team_id = _team_id
  LIMIT 1
  INTO user_role;
  
  RETURN user_role;
END;
$$;

-- Recreate all policies that were dropped by CASCADE

-- team_members policies
CREATE POLICY "Team members can view team_members"
ON public.team_members
FOR SELECT
USING (has_team_membership(auth.uid(), team_id));

CREATE POLICY "Team owners and admins can insert team_members"
ON public.team_members
FOR INSERT
WITH CHECK (
  is_team_admin(auth.uid(), team_id)
  OR (auth.uid() = user_id AND role = 'owner')
);

-- shared_inboxes policies
CREATE POLICY "Team members can view shared_inboxes"
ON public.shared_inboxes
FOR SELECT
USING (has_team_membership(auth.uid(), team_id));

-- assignment_rules policies
CREATE POLICY "Team members can view assignment rules"
ON public.assignment_rules
FOR SELECT
USING (has_team_membership(auth.uid(), team_id));

-- assignments policies
CREATE POLICY "Team members can view assignments"
ON public.assignments
FOR SELECT
USING (has_team_membership(auth.uid(), team_id));

CREATE POLICY "Team members can create assignments"
ON public.assignments
FOR INSERT
WITH CHECK (has_team_membership(auth.uid(), team_id) AND auth.uid() = assigned_by_user_id);

-- internal_notes policies
CREATE POLICY "Team members can view internal notes"
ON public.internal_notes
FOR SELECT
USING (has_team_membership(auth.uid(), team_id));

CREATE POLICY "Team members can create internal notes"
ON public.internal_notes
FOR INSERT
WITH CHECK (has_team_membership(auth.uid(), team_id) AND auth.uid() = author_id);

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.has_team_membership(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_team_admin(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_team_role(uuid, uuid) TO authenticated;

-- Add helpful comments
COMMENT ON FUNCTION public.has_team_membership IS 'Checks if a user is a member of a team. Uses SECURITY DEFINER with RLS bypass to prevent infinite recursion.';
COMMENT ON FUNCTION public.is_team_admin IS 'Checks if a user is an admin or owner of a team. Uses SECURITY DEFINER with RLS bypass to prevent infinite recursion.';
COMMENT ON FUNCTION public.get_user_team_role IS 'Gets a user''s role in a team. Uses SECURITY DEFINER with RLS bypass to prevent infinite recursion.';