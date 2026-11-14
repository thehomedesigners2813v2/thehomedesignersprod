/*
  # Fix Designer Profile Images Storage Policies

  1. Changes
    - Drop existing restrictive policies
    - Create simpler policies that allow authenticated users to upload to their own folder
    - Ensure newly registered users can upload during registration process
  
  2. Security
    - Authenticated users can upload/update/delete files in their own folder (user_id)
    - Public read access for all profile images
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Designers can upload own profile image" ON storage.objects;
DROP POLICY IF EXISTS "Designers can update own profile image" ON storage.objects;
DROP POLICY IF EXISTS "Designers can delete own profile image" ON storage.objects;
DROP POLICY IF EXISTS "Public can view profile images" ON storage.objects;

-- Allow authenticated users to insert their own profile images
DROP POLICY IF EXISTS "Authenticated users can upload own profile image" ON storage.objects;
CREATE POLICY "Authenticated users can upload own profile image"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'designer-profiles' AND
    (SELECT split_part(name, '/', 1)) = auth.uid()::text::text
  );

-- Allow authenticated users to update their own profile images
DROP POLICY IF EXISTS "Authenticated users can update own profile image" ON storage.objects;
CREATE POLICY "Authenticated users can update own profile image"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'designer-profiles' AND
    (SELECT split_part(name, '/', 1)) = auth.uid()::text::text
  )
  WITH CHECK (
    bucket_id = 'designer-profiles' AND
    (SELECT split_part(name, '/', 1)) = auth.uid()::text::text
  );

-- Allow authenticated users to delete their own profile images
DROP POLICY IF EXISTS "Authenticated users can delete own profile image" ON storage.objects;
CREATE POLICY "Authenticated users can delete own profile image"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'designer-profiles' AND
    (SELECT split_part(name, '/', 1)) = auth.uid()::text::text
  );

-- Allow public read access to all profile images
DROP POLICY IF EXISTS "Anyone can view profile images" ON storage.objects;
CREATE POLICY "Anyone can view profile images"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'designer-profiles');