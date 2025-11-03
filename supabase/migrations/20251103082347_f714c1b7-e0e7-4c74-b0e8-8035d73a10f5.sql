-- Create storage buckets for profile pictures and email branding
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('avatars', 'avatars', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('email-branding', 'email-branding', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'])
ON CONFLICT (id) DO NOTHING;

-- Add avatar_url to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Add email template fields to business_profiles if they don't exist
ALTER TABLE public.business_profiles 
ADD COLUMN IF NOT EXISTS email_logo_url TEXT,
ADD COLUMN IF NOT EXISTS email_brand_color TEXT DEFAULT '#8b5cf6',
ADD COLUMN IF NOT EXISTS email_footer_text TEXT,
ADD COLUMN IF NOT EXISTS email_signature TEXT,
ADD COLUMN IF NOT EXISTS email_template_style TEXT DEFAULT 'professional';

-- RLS Policies for avatars bucket
CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Anyone can view avatars"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- RLS Policies for email-branding bucket
CREATE POLICY "Users can upload their own email branding"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'email-branding' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own email branding"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'email-branding' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own email branding"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'email-branding' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Anyone can view email branding"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'email-branding');