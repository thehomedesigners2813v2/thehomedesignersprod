/*
# Restore wallpapers_3d RLS policies

The CRUD policies on wallpapers_3d were removed during earlier migrations, leaving only a broken SELECT policy. This migration replaces them with:

1. Public read access to active wallpapers (the gallery needs no login).
2. Admin read of all wallpapers, including inactive ones.
3. Admin insert, update, and delete, limited to users in admin_users.

Only policies on wallpapers_3d are changed. No rows are deleted.
*/

DROP POLICY IF EXISTS "Somnath can view active wallpapers" ON wallpapers_3d;
DROP POLICY IF EXISTS "Anyone can view active wallpapers" ON wallpapers_3d;
DROP POLICY IF EXISTS "Admins can view all wallpapers" ON wallpapers_3d;
DROP POLICY IF EXISTS "Admins can insert wallpapers" ON wallpapers_3d;
DROP POLICY IF EXISTS "Admins can update wallpapers" ON wallpapers_3d;
DROP POLICY IF EXISTS "Admins can delete wallpapers" ON wallpapers_3d;

CREATE POLICY "Anyone can view active wallpapers"
  ON wallpapers_3d FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can view all wallpapers"
  ON wallpapers_3d FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid()));

DROP POLICY IF EXISTS "Admins can insert wallpapers" ON wallpapers_3d;
CREATE POLICY "Admins can insert wallpapers"
  ON wallpapers_3d FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid()));

DROP POLICY IF EXISTS "Admins can update wallpapers" ON wallpapers_3d;
CREATE POLICY "Admins can update wallpapers"
  ON wallpapers_3d FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid()));

DROP POLICY IF EXISTS "Admins can delete wallpapers" ON wallpapers_3d;
CREATE POLICY "Admins can delete wallpapers"
  ON wallpapers_3d FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid()));
