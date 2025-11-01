-- Fix accept_team_invitation function by removing SET search_path
-- and using fully qualified table names instead

CREATE OR REPLACE FUNCTION public.accept_team_invitation(invitation_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  invitation_record record;
  result jsonb;
BEGIN
  -- Get invitation (using fully qualified table name)
  SELECT * INTO invitation_record
  FROM public.team_invitations
  WHERE token = invitation_token
    AND status = 'pending'
    AND expires_at > now();
    
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired invitation');
  END IF;
  
  -- Check if user email matches (using fully qualified table name)
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND email = invitation_record.email
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Email does not match invitation');
  END IF;
  
  -- Add user to team (using fully qualified table name)
  INSERT INTO public.team_members (team_id, user_id, role)
  VALUES (invitation_record.team_id, auth.uid(), invitation_record.role)
  ON CONFLICT (team_id, user_id) DO NOTHING;
  
  -- Mark invitation as accepted (using fully qualified table name)
  UPDATE public.team_invitations
  SET status = 'accepted', accepted_at = now()
  WHERE token = invitation_token;
  
  RETURN jsonb_build_object(
    'success', true, 
    'team_id', invitation_record.team_id,
    'role', invitation_record.role
  );
END;
$$;