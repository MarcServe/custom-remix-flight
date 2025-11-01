-- Create team_invitations table for pending invites
CREATE TABLE public.team_invitations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'member',
  invited_by_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  status text NOT NULL DEFAULT 'pending',
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  accepted_at timestamp with time zone,
  CONSTRAINT valid_role CHECK (role IN ('owner', 'admin', 'member')),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled'))
);

-- Create index for faster lookups
CREATE INDEX idx_team_invitations_email ON public.team_invitations(email);
CREATE INDEX idx_team_invitations_token ON public.team_invitations(token);
CREATE INDEX idx_team_invitations_team_id ON public.team_invitations(team_id);

-- Enable RLS
ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY;

-- Team members can view invitations for their team
CREATE POLICY "Team members can view team invitations"
ON public.team_invitations
FOR SELECT
USING (public.has_team_membership(auth.uid(), team_id));

-- Team admins can create invitations
CREATE POLICY "Team admins can create invitations"
ON public.team_invitations
FOR INSERT
WITH CHECK (
  public.is_team_admin(auth.uid(), team_id) 
  AND auth.uid() = invited_by_user_id
);

-- Team admins can update invitations (cancel, etc)
CREATE POLICY "Team admins can update invitations"
ON public.team_invitations
FOR UPDATE
USING (public.is_team_admin(auth.uid(), team_id));

-- Team admins can delete invitations
CREATE POLICY "Team admins can delete invitations"
ON public.team_invitations
FOR DELETE
USING (public.is_team_admin(auth.uid(), team_id));

-- Create function to accept invitation
CREATE OR REPLACE FUNCTION public.accept_team_invitation(invitation_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invitation_record record;
  result jsonb;
BEGIN
  -- Get invitation
  SELECT * INTO invitation_record
  FROM team_invitations
  WHERE token = invitation_token
    AND status = 'pending'
    AND expires_at > now();
    
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired invitation');
  END IF;
  
  -- Check if user email matches
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND email = invitation_record.email
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Email does not match invitation');
  END IF;
  
  -- Add user to team
  INSERT INTO team_members (team_id, user_id, role)
  VALUES (invitation_record.team_id, auth.uid(), invitation_record.role)
  ON CONFLICT (team_id, user_id) DO NOTHING;
  
  -- Mark invitation as accepted
  UPDATE team_invitations
  SET status = 'accepted', accepted_at = now()
  WHERE token = invitation_token;
  
  RETURN jsonb_build_object(
    'success', true, 
    'team_id', invitation_record.team_id,
    'role', invitation_record.role
  );
END;
$$;