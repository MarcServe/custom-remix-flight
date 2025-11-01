-- Add job_title column to profiles table
ALTER TABLE public.profiles
ADD COLUMN job_title TEXT;

COMMENT ON COLUMN public.profiles.job_title IS 'User job title/position for email signatures';