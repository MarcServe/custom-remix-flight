-- Drop existing insert policy
DROP POLICY IF EXISTS "Users can insert email threads" ON email_threads;

-- Create simplified insert policy that allows authenticated users to insert threads
CREATE POLICY "Users can insert email threads" ON email_threads
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- Also update the update policy to be simpler
DROP POLICY IF EXISTS "Users can update email threads" ON email_threads;

CREATE POLICY "Users can update email threads" ON email_threads
FOR UPDATE 
USING (auth.uid() IS NOT NULL);

-- Keep the view policy as is since it's already working correctly
-- (It checks sequence ownership when company_sequence_id is present)