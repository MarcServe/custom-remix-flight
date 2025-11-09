-- Drop and recreate the accept_team_invitation function with better email matching
DROP FUNCTION IF EXISTS public.accept_team_invitation(text);

CREATE OR REPLACE FUNCTION public.accept_team_invitation(invitation_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  invitation_record record;
  user_email text;
  result jsonb;
BEGIN
  -- Get the current user's email
  SELECT email INTO user_email
  FROM public.profiles 
  WHERE id = auth.uid();
  
  -- Log for debugging
  RAISE LOG 'Accepting invitation - User: %, Token: %', user_email, invitation_token;
  
  -- Get invitation (using fully qualified table name)
  SELECT * INTO invitation_record
  FROM public.team_invitations
  WHERE token = invitation_token
    AND status = 'pending'
    AND expires_at > now();
    
  IF NOT FOUND THEN
    RAISE LOG 'Invitation not found or expired - Token: %', invitation_token;
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired invitation');
  END IF;
  
  RAISE LOG 'Found invitation - Email: %, Status: %', invitation_record.email, invitation_record.status;
  
  -- Check if user email matches (case-insensitive)
  IF user_email IS NULL THEN
    RAISE LOG 'User email not found in profiles table';
    RETURN jsonb_build_object('success', false, 'error', 'User profile not found. Please try again.');
  END IF;
  
  IF LOWER(user_email) != LOWER(invitation_record.email) THEN
    RAISE LOG 'Email mismatch - User: %, Invitation: %', user_email, invitation_record.email;
    RETURN jsonb_build_object('success', false, 'error', 'Email does not match invitation');
  END IF;
  
  -- Add user to team (using fully qualified table name)
  INSERT INTO public.team_members (team_id, user_id, role)
  VALUES (invitation_record.team_id, auth.uid(), invitation_record.role)
  ON CONFLICT (team_id, user_id) DO UPDATE SET role = EXCLUDED.role;
  
  RAISE LOG 'Added user to team - Team: %, User: %, Role: %', 
    invitation_record.team_id, auth.uid(), invitation_record.role;
  
  -- Mark invitation as accepted (using fully qualified table name)
  UPDATE public.team_invitations
  SET status = 'accepted', accepted_at = now()
  WHERE token = invitation_token;
  
  RETURN jsonb_build_object(
    'success', true, 
    'team_id', invitation_record.team_id,
    'role', invitation_record.role
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error accepting invitation: %', SQLERRM;
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;