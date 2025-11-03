-- Fix the is_team_admin function to also check teams.owner_id
CREATE OR REPLACE FUNCTION public.is_team_admin(_user_id uuid, _team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    -- Check if user is owner in teams table
    SELECT 1 FROM public.teams
    WHERE id = _team_id AND owner_id = _user_id
  ) OR EXISTS (
    -- Check if user has owner/admin role in team_members
    SELECT 1 FROM public.team_members
    WHERE user_id = _user_id
      AND team_id = _team_id
      AND role IN ('owner', 'admin')
  )
$$;

-- Fix existing data: Update team owners to have correct role in team_members
UPDATE public.team_members
SET role = 'owner'
WHERE id IN (
  SELECT tm.id
  FROM team_members tm
  JOIN teams t ON tm.team_id = t.id
  WHERE tm.user_id = t.owner_id
  AND tm.role != 'owner'
);

-- Insert missing team owners into team_members
INSERT INTO public.team_members (team_id, user_id, role, permissions)
SELECT t.id, t.owner_id, 'owner', '{}'::jsonb
FROM teams t
WHERE NOT EXISTS (
  SELECT 1 FROM team_members tm
  WHERE tm.team_id = t.id AND tm.user_id = t.owner_id
)
ON CONFLICT DO NOTHING;