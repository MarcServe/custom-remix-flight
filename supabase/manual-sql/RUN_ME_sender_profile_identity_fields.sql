-- Run this in Supabase Dashboard > SQL Editor
-- Adds sender_name, sender_email, sender_title to sender_profiles

ALTER TABLE public.sender_profiles
  ADD COLUMN IF NOT EXISTS sender_name TEXT,
  ADD COLUMN IF NOT EXISTS sender_email TEXT,
  ADD COLUMN IF NOT EXISTS sender_title TEXT;
