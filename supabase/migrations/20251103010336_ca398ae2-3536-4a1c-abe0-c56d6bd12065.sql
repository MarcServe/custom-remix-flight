-- Assign all existing data to michaelorji5111@gmail.com
-- First, get the user_id for the email
DO $$
DECLARE
  target_user_id uuid;
BEGIN
  -- Get the user_id for michaelorji5111@gmail.com
  SELECT id INTO target_user_id 
  FROM auth.users 
  WHERE email = 'michaelorji5111@gmail.com';
  
  -- Only proceed if user exists
  IF target_user_id IS NOT NULL THEN
    -- Update all people records
    UPDATE public.people 
    SET user_id = target_user_id;
    
    -- Update all deals records
    UPDATE public.deals 
    SET user_id = target_user_id;
    
    -- Update all companies records
    UPDATE public.companies 
    SET user_id = target_user_id;
    
    RAISE NOTICE 'Successfully assigned all data to user %', target_user_id;
  ELSE
    RAISE EXCEPTION 'User with email michaelorji5111@gmail.com not found';
  END IF;
END $$;