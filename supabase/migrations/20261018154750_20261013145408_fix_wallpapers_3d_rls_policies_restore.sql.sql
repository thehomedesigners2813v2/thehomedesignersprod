/*
# Fix wallpapers_3d RLS policies (restore all CRUD)

All CRUD policies on wallpapers_3d were wiped during fresh-start migrations.
Only a broken SELECT policy remained (hardcoded to one user's email, no
INSERT/UPDATE/DELETE at all). This restores:

- Public (anon + authenticated) SELECT for active wallpapers (gallery is public)
- Admin SELECT for all wallpapers (active and inactive)
- Admin INSERT/UPDATE/DELETE

Admin authorization is verified via the admin_users table. Existing rows
are preserved; only policies are replaced.
*/

-- Fix wallpapers_3d RLS policies: all CRUD policies were wiped during fresh-start migrations
-- Only a broken SELECT policy remained (hardcoded to one user's email, no INSERT/UPDATE/DELETE at all)

-- Drop the broken policy
DROP POLICY IF EXISTS "Somnath can view active wallpapers" ON wallpapers_3d;
DROP POLICY IF EXISTS "Anyone can view active wallpapers" ON wallpapers_3d;
DROP POLICY IF EXISTS "Admins can view all wallpapers" ON wallpapers_3d;
DROP POLICY IF EXISTS "Admins can insert wallpapers" ON wallpapers_3d;
DROP POLICY IF EXISTS "Admins can update wallpapers" ON wallpapers_3d;
DROP POLICY IF EXISTS "Admins can delete wallpapers" ON wallpapers_3d;

-- Public can view active wallpapers (gallery is public, no login required)
CREATE POLICY "Anyone can view active wallpapers"
  ON wallpapers_3d FOR SELECT
  USING (is_active = true);

-- Admins can view all wallpapers (active and inactive)
DROP POLICY IF EXISTS "Admins can view all wallpapers" ON wallpapers_3d;
CREATE POLICY "Admins can view all wallpapers"
  ON wallpapers_3d FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

-- Admins can insert wallpapers
DROP POLICY IF EXISTS "Admins can insert wallpapers" ON wallpapers_3d;
CREATE POLICY "Admins can insert wallpapers"
  ON wallpapers_3d FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

-- Admins can update wallpapers
DROP POLICY IF EXISTS "Admins can update wallpapers" ON wallpapers_3d;
CREATE POLICY "Admins can update wallpapers"
  ON wallpapers_3d FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

-- Admins can delete wallpapers
DROP POLICY IF EXISTS "Admins can delete wallpapers" ON wallpapers_3d;
CREATE POLICY "Admins can delete wallpapers"
  ON wallpapers_3d FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );
