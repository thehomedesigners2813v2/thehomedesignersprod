-- Re-create the wallpaper-images storage bucket (was deleted during fresh-start migrations)
INSERT INTO storage.buckets (id, name, public)
VALUES ('wallpaper-images', 'wallpaper-images', true)
ON CONFLICT (id) DO NOTHING;

-- Drop any stale policies just in case
DROP POLICY IF EXISTS "Public can view wallpaper images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload wallpaper images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update wallpaper images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete wallpaper images" ON storage.objects;

-- Public read access for viewing wallpaper images
CREATE POLICY "Public can view wallpaper images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'wallpaper-images');

-- Admin-only upload access (using user_id column per fix migration 20260317174427)
DROP POLICY IF EXISTS "Admins can upload wallpaper images" ON storage.objects;
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

-- Admin-only update access
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

-- Admin-only delete access
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