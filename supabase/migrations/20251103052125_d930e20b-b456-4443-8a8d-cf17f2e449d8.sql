-- Fix team security functions by changing from STABLE to VOLATILE
-- Drop and recreate has_team_membership as VOLATILE
DROP FUNCTION IF EXISTS public.has_team_membership(uuid, uuid) CASCADE;

CREATE OR REPLACE FUNCTION public.has_team_membership(_user_id uuid, _team_id uuid)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result boolean;
BEGIN
  SET LOCAL row_security = off;
  
  SELECT EXISTS (
    SELECT 1
    FROM public.team_members
    WHERE user_id = _user_id AND team_id = _team_id
  ) INTO result;
  
  RETURN result;
END;
$$;

-- Drop and recreate is_team_admin as VOLATILE
DROP FUNCTION IF EXISTS public.is_team_admin(uuid, uuid) CASCADE;

CREATE OR REPLACE FUNCTION public.is_team_admin(_user_id uuid, _team_id uuid)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result boolean;
BEGIN
  SET LOCAL row_security = off;
  
  SELECT EXISTS (
    SELECT 1
    FROM public.team_members
    WHERE user_id = _user_id AND team_id = _team_id AND role IN ('owner', 'admin')
  ) INTO result;
  
  RETURN result;
END;
$$;

-- Drop and recreate get_user_team_role as VOLATILE
DROP FUNCTION IF EXISTS public.get_user_team_role(uuid, uuid) CASCADE;

CREATE OR REPLACE FUNCTION public.get_user_team_role(_user_id uuid, _team_id uuid)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role text;
BEGIN
  SET LOCAL row_security = off;
  
  SELECT role FROM public.team_members
  WHERE user_id = _user_id AND team_id = _team_id
  LIMIT 1 INTO user_role;
  
  RETURN user_role;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.has_team_membership(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_team_admin(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_team_role(uuid, uuid) TO authenticated;