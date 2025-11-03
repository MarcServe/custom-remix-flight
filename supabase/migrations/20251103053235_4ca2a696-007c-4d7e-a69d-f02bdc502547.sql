-- RLS policies for crm-files bucket
-- Note: storage.objects RLS is already enabled by Supabase

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Users can view their own crm files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own crm files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own crm files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own crm files" ON storage.objects;

-- Policy: Users can view their own files
CREATE POLICY "Users can view their own crm files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'crm-files' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can upload their own files
CREATE POLICY "Users can upload their own crm files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'crm-files' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can update their own files
CREATE POLICY "Users can update their own crm files"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'crm-files' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can delete their own files
CREATE POLICY "Users can delete their own crm files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'crm-files' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);