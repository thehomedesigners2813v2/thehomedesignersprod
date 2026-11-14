/*
  # Create Designer Profile Images Storage Bucket

  1. Storage Setup
    - Create a public storage bucket for designer profile images
    - Set up policies for authenticated designers to upload their own profile images
    - Allow public read access to profile images
  
  2. Security
    - Only authenticated designers can upload
    - File size limits enforced in application layer (2MB max)
    - Public read access for displaying profile images
*/

-- Create storage bucket for designer profile images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'designer-profiles',
  'designer-profiles',
  true,
  2097152, -- 2MB in bytes
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload their own profile images
DROP POLICY IF EXISTS "Designers can upload own profile image" ON storage.objects;
CREATE POLICY "Designers can upload own profile image"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'designer-profiles' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow designers to update their own profile images
DROP POLICY IF EXISTS "Designers can update own profile image" ON storage.objects;
CREATE POLICY "Designers can update own profile image"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'designer-profiles' AND
    (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'designer-profiles' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow designers to delete their own profile images
DROP POLICY IF EXISTS "Designers can delete own profile image" ON storage.objects;
CREATE POLICY "Designers can delete own profile image"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'designer-profiles' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow public read access to all profile images
DROP POLICY IF EXISTS "Public can view profile images" ON storage.objects;
CREATE POLICY "Public can view profile images"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'designer-profiles');