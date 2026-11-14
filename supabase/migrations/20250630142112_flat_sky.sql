/*
  # Fix project-images storage bucket

  1. New Storage Bucket
    - Create a new storage bucket for project images
    - Set up public access for project images
    - Configure RLS policies for the bucket

  2. Security
    - Enable RLS on the bucket
    - Add policies for users to manage their own images
    - Allow public read access to images
*/

-- Create storage bucket for project images if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'project-images',
  'Project Images',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

-- Drop existing policies to avoid conflicts
DO $$
BEGIN
  -- Drop policies if they exist
  IF EXISTS (
    SELECT 1 FROM pg_policy 
    WHERE polname = 'Users can upload project images' 
    AND polrelid = 'storage.objects'::regclass
  ) THEN
    DROP POLICY "Users can upload project images" ON storage.objects;
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM pg_policy 
    WHERE polname = 'Users can update their own project images' 
    AND polrelid = 'storage.objects'::regclass
  ) THEN
    DROP POLICY "Users can update their own project images" ON storage.objects;
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM pg_policy 
    WHERE polname = 'Users can delete their own project images' 
    AND polrelid = 'storage.objects'::regclass
  ) THEN
    DROP POLICY "Users can delete their own project images" ON storage.objects;
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM pg_policy 
    WHERE polname = 'Anyone can view project images' 
    AND polrelid = 'storage.objects'::regclass
  ) THEN
    DROP POLICY "Anyone can view project images" ON storage.objects;
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM pg_policy 
    WHERE polname = 'Users can upload to own folder' 
    AND polrelid = 'storage.objects'::regclass
  ) THEN
    DROP POLICY "Users can upload to own folder" ON storage.objects;
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM pg_policy 
    WHERE polname = 'Users can update own files' 
    AND polrelid = 'storage.objects'::regclass
  ) THEN
    DROP POLICY "Users can update own files" ON storage.objects;
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM pg_policy 
    WHERE polname = 'Users can delete own files' 
    AND polrelid = 'storage.objects'::regclass
  ) THEN
    DROP POLICY "Users can delete own files" ON storage.objects;
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM pg_policy 
    WHERE polname = 'Public can view all images' 
    AND polrelid = 'storage.objects'::regclass
  ) THEN
    DROP POLICY "Public can view all images" ON storage.objects;
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM pg_policy 
    WHERE polname = 'Anonymous users can upload' 
    AND polrelid = 'storage.objects'::regclass
  ) THEN
    DROP POLICY "Anonymous users can upload" ON storage.objects;
  END IF;
END $$;

-- Create new policies
DROP POLICY IF EXISTS "Users can upload to project-images" ON storage.objects;
CREATE POLICY "Users can upload to project-images"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'project-images' AND
    (auth.uid()::text::text = (storage.foldername(name))[2] OR auth.uid()::text::text = (storage.foldername(name))[1])
  );

DROP POLICY IF EXISTS "Users can update own project-images" ON storage.objects;
CREATE POLICY "Users can update own project-images"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'project-images' AND
    (auth.uid()::text::text = (storage.foldername(name))[2] OR auth.uid()::text::text = (storage.foldername(name))[1])
  );

DROP POLICY IF EXISTS "Users can delete own project-images" ON storage.objects;
CREATE POLICY "Users can delete own project-images"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'project-images' AND
    (auth.uid()::text::text = (storage.foldername(name))[2] OR auth.uid()::text::text = (storage.foldername(name))[1])
  );

DROP POLICY IF EXISTS "Anyone can view project-images" ON storage.objects;
CREATE POLICY "Anyone can view project-images"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'project-images');

-- Allow anonymous uploads for non-authenticated users
DROP POLICY IF EXISTS "Anonymous users can upload to project-images" ON storage.objects;
CREATE POLICY "Anonymous users can upload to project-images"
  ON storage.objects
  FOR INSERT
  TO anon
  WITH CHECK (
    bucket_id = 'project-images' AND
    (storage.foldername(name))[1] = 'anonymous'
  );