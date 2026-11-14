/*
  # Fix 3D Wallpapers RLS Policies

  1. Changes
    - Fix admin check to use user_id instead of id
    - Correct column reference in RLS policies
  
  2. Security
    - Admins can manage all wallpapers
    - Public can view active wallpapers
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can view all wallpapers" ON wallpapers_3d;
DROP POLICY IF EXISTS "Admins can insert wallpapers" ON wallpapers_3d;
DROP POLICY IF EXISTS "Admins can update wallpapers" ON wallpapers_3d;
DROP POLICY IF EXISTS "Admins can delete wallpapers" ON wallpapers_3d;
DROP POLICY IF EXISTS "Anyone can view active wallpapers" ON wallpapers_3d;

-- Recreate policies with correct column reference
CREATE POLICY "Admins can view all wallpapers"
ON wallpapers_3d FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.user_id = auth.uid()
  )
);

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

DROP POLICY IF EXISTS "Anyone can view active wallpapers" ON wallpapers_3d;
CREATE POLICY "Anyone can view active wallpapers"
ON wallpapers_3d FOR SELECT
TO public
USING (is_active = true);