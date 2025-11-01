-- Add unique constraint on user_id in business_profiles if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'business_profiles_user_id_key'
  ) THEN
    ALTER TABLE public.business_profiles 
    ADD CONSTRAINT business_profiles_user_id_key UNIQUE (user_id);
  END IF;
END $$;