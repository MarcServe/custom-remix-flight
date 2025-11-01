
-- Add missing foreign key constraint from team_members to profiles
-- This allows PostgREST to properly join profiles data when querying team members

ALTER TABLE public.team_members
ADD CONSTRAINT team_members_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES public.profiles(id) 
ON DELETE CASCADE;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON public.team_members(user_id);
