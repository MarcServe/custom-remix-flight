-- Add user_id to people table for user isolation
ALTER TABLE public.people ADD COLUMN user_id UUID;

-- Backfill existing people with the first user's ID (temporary)
UPDATE public.people 
SET user_id = (SELECT id FROM auth.users LIMIT 1)
WHERE user_id IS NULL;

-- Make user_id required
ALTER TABLE public.people ALTER COLUMN user_id SET NOT NULL;

-- Add index for performance
CREATE INDEX idx_people_user_id ON public.people(user_id);

-- Drop existing RLS policies on people
DROP POLICY IF EXISTS "Users can view all people" ON public.people;
DROP POLICY IF EXISTS "Users can create people" ON public.people;
DROP POLICY IF EXISTS "Users can update people" ON public.people;
DROP POLICY IF EXISTS "Users can delete people" ON public.people;

-- Create new RLS policies for people table
CREATE POLICY "Users can view their own people"
  ON public.people
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own people"
  ON public.people
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own people"
  ON public.people
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own people"
  ON public.people
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add user_id to deals table for user isolation
ALTER TABLE public.deals ADD COLUMN user_id UUID;

-- Backfill existing deals with the first user's ID (temporary)
UPDATE public.deals 
SET user_id = (SELECT id FROM auth.users LIMIT 1)
WHERE user_id IS NULL;

-- Make user_id required
ALTER TABLE public.deals ALTER COLUMN user_id SET NOT NULL;

-- Add index for performance
CREATE INDEX idx_deals_user_id ON public.deals(user_id);

-- Drop existing RLS policies on deals
DROP POLICY IF EXISTS "Users can view all deals" ON public.deals;
DROP POLICY IF EXISTS "Users can create deals" ON public.deals;
DROP POLICY IF EXISTS "Users can update deals" ON public.deals;
DROP POLICY IF EXISTS "Users can delete deals" ON public.deals;

-- Create new RLS policies for deals table
CREATE POLICY "Users can view their own deals"
  ON public.deals
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own deals"
  ON public.deals
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own deals"
  ON public.deals
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own deals"
  ON public.deals
  FOR DELETE
  USING (auth.uid() = user_id);