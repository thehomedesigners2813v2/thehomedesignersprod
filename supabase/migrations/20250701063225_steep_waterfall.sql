/*
  # Create storage bucket for project images with policy checks

  1. New Storage
    - Creates a storage bucket for project images if it doesn't exist
    - Sets up appropriate security policies with existence checks
  
  2. Security
    - Enables public read access to all files
    - Allows authenticated users to upload files
    - Restricts update/delete to file owners
*/

-- Create storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-images', 'project-images', true)
ON CONFLICT (id) DO NOTHING;

-- Create policies only if they don't exist
DO $$
BEGIN
  -- Check if "Public Access" policy exists before creating
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Public Access' 
    AND tablename = 'objects' 
    AND schemaname = 'storage'
  ) THEN
    -- Allow public access to all files in the bucket
    DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'project-images');
  END IF;

  -- Check if "Authenticated users can upload files" policy exists before creating
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Authenticated users can upload files' 
    AND tablename = 'objects' 
    AND schemaname = 'storage'
  ) THEN
    -- Allow authenticated users to upload files
    DROP POLICY IF EXISTS "Authenticated users can upload files" ON storage.objects;
CREATE POLICY "Authenticated users can upload files"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'project-images');
  END IF;

  -- Check if "Users can update their own files" policy exists before creating
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Users can update their own files' 
    AND tablename = 'objects' 
    AND schemaname = 'storage'
  ) THEN
    -- Allow users to update their own files
    DROP POLICY IF EXISTS "Users can update their own files" ON storage.objects;
CREATE POLICY "Users can update their own files"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (bucket_id = 'project-images' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;

  -- Check if "Users can delete their own files" policy exists before creating
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Users can delete their own files' 
    AND tablename = 'objects' 
    AND schemaname = 'storage'
  ) THEN
    -- Allow users to delete their own files
    DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;
CREATE POLICY "Users can delete their own files"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'project-images' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;
END $$;