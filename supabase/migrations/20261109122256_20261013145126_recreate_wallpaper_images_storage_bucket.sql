/*
# Recreate wallpaper-images storage bucket and its policies

1. Ensures a public `wallpaper-images` storage bucket exists. Existing files are not touched.
2. Public users can view wallpaper images.
3. Only admins (users listed in admin_users) can upload, update, or delete images in that bucket.

Nothing is deleted from storage.objects. Only the four policies named here are replaced.
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('wallpaper-images', 'wallpaper-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public can view wallpaper images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload wallpaper images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update wallpaper images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete wallpaper images" ON storage.objects;

CREATE POLICY "Public can view wallpaper images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'wallpaper-images');

CREATE POLICY "Admins can upload wallpaper images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'wallpaper-images' AND
    EXISTS (SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Admins can update wallpaper images" ON storage.objects;
CREATE POLICY "Admins can update wallpaper images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'wallpaper-images' AND
    EXISTS (SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid())
  )
  WITH CHECK (
    bucket_id = 'wallpaper-images' AND
    EXISTS (SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Admins can delete wallpaper images" ON storage.objects;
CREATE POLICY "Admins can delete wallpaper images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'wallpaper-images' AND
    EXISTS (SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid())
  );
