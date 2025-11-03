-- Add phone column to business_profiles if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'business_profiles' 
    AND column_name = 'phone'
  ) THEN
    ALTER TABLE public.business_profiles ADD COLUMN phone text;
  END IF;
END $$;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_business_profiles_phone ON public.business_profiles(phone);