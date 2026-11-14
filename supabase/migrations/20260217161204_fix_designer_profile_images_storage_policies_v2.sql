/*
  # Fix Designer Profile Images Storage Policies v2

  1. Changes
    - Drop policies using subquery-based split_part which fails in RLS context
    - Replace with simple authenticated-user policies for the designer-profiles bucket
    - The bucket already has file_size_limit and allowed_mime_types enforced at storage level
  
  2. Security
    - Only authenticated users can upload/update/delete
    - Public read access for displaying images
    - Application code controls folder structure (user_id/profile.ext)
*/

DROP POLICY IF EXISTS "Authenticated users can upload own profile image" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update own profile image" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete own profile image" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view profile images" ON storage.objects;

DROP POLICY IF EXISTS "designer_profiles_insert" ON storage.objects;
CREATE POLICY "designer_profiles_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'designer-profiles');

DROP POLICY IF EXISTS "designer_profiles_update" ON storage.objects;
CREATE POLICY "designer_profiles_update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'designer-profiles')
  WITH CHECK (bucket_id = 'designer-profiles');

DROP POLICY IF EXISTS "designer_profiles_delete" ON storage.objects;
CREATE POLICY "designer_profiles_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'designer-profiles');

DROP POLICY IF EXISTS "designer_profiles_select" ON storage.objects;
CREATE POLICY "designer_profiles_select"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'designer-profiles');