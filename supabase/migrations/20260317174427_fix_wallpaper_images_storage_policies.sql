/*
  # Fix Wallpaper Images Storage Policies

  1. Changes
    - Update storage policies for wallpaper-images bucket to use correct column
    - Change from `admin_users.id` to `admin_users.user_id` to match auth.uid()
    
  2. Security
    - Maintains admin-only access for uploads, updates, and deletes
    - Keeps public read access for viewing images
    
  3. Issue Fixed
    - Resolves "new row violates row-level security policy" error
    - Admin users can now upload wallpaper images successfully
*/

-- Drop existing wallpaper-images storage policies
DROP POLICY IF EXISTS "Public can view wallpaper images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload wallpaper images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update wallpaper images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete wallpaper images" ON storage.objects;

-- Recreate storage policies with correct column reference
CREATE POLICY "Public can view wallpaper images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'wallpaper-images');

CREATE POLICY "Admins can upload wallpaper images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'wallpaper-images' AND
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can update wallpaper images" ON storage.objects;
CREATE POLICY "Admins can update wallpaper images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'wallpaper-images' AND
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  )
  WITH CHECK (
    bucket_id = 'wallpaper-images' AND
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can delete wallpaper images" ON storage.objects;
CREATE POLICY "Admins can delete wallpaper images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'wallpaper-images' AND
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );
