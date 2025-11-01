-- Create admin team and auto-assign users on signup

-- First, ensure we have an admin team (idempotent)
DO $$
DECLARE
  admin_team_id uuid;
  admin_user_id uuid;
BEGIN
  -- Get the admin user's ID
  SELECT id INTO admin_user_id
  FROM auth.users
  WHERE email = 'michaelorji5111@gmail.com'
  LIMIT 1;

  -- Check if admin team already exists
  SELECT id INTO admin_team_id
  FROM teams
  WHERE name = 'Admin Team'
  LIMIT 1;

  -- Create admin team if it doesn't exist
  IF admin_team_id IS NULL AND admin_user_id IS NOT NULL THEN
    INSERT INTO teams (name, description, owner_id)
    VALUES ('Admin Team', 'Default team for all users', admin_user_id)
    RETURNING id INTO admin_team_id;
    
    -- Add admin user as owner of the admin team
    INSERT INTO team_members (team_id, user_id, role)
    VALUES (admin_team_id, admin_user_id, 'owner')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- Create function to add new users to admin team automatically
CREATE OR REPLACE FUNCTION public.add_user_to_admin_team()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_team_id uuid;
BEGIN
  -- Get the admin team ID
  SELECT id INTO admin_team_id
  FROM teams
  WHERE name = 'Admin Team'
  LIMIT 1;

  -- Add user to admin team as member
  IF admin_team_id IS NOT NULL THEN
    INSERT INTO team_members (team_id, user_id, role)
    VALUES (admin_team_id, NEW.id, 'member')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger to auto-add users to admin team on signup
DROP TRIGGER IF EXISTS on_user_signup_add_to_admin_team ON auth.users;

CREATE TRIGGER on_user_signup_add_to_admin_team
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.add_user_to_admin_team();

-- Grant admin role to michaelorji5111@gmail.com
DO $$
DECLARE
  admin_user_id uuid;
  admin_team_id uuid;
BEGIN
  -- Get the admin user's ID
  SELECT id INTO admin_user_id
  FROM auth.users
  WHERE email = 'michaelorji5111@gmail.com'
  LIMIT 1;

  -- Get admin team ID
  SELECT id INTO admin_team_id
  FROM teams
  WHERE name = 'Admin Team'
  LIMIT 1;

  -- Make them owner of admin team if they exist
  IF admin_user_id IS NOT NULL AND admin_team_id IS NOT NULL THEN
    INSERT INTO team_members (team_id, user_id, role)
    VALUES (admin_team_id, admin_user_id, 'owner')
    ON CONFLICT (team_id, user_id) 
    DO UPDATE SET role = 'owner';
  END IF;
END $$;