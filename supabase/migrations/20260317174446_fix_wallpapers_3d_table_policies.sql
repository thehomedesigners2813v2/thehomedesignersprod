/*
  # Fix Wallpapers 3D Table RLS Policies

  1. Changes
    - Update RLS policies for wallpapers_3d table to use correct column
    - Change from `admin_users.id` to `admin_users.user_id` to match auth.uid()
    
  2. Security
    - Maintains admin-only access for insert, update, and delete
    - Keeps public read access for active wallpapers
    - Admin read access for all wallpapers
    
  3. Issue Fixed
    - Ensures admin users can perform all operations on wallpapers_3d table
*/

-- Drop existing policies on wallpapers_3d table
DROP POLICY IF EXISTS "Anyone can view active wallpapers" ON wallpapers_3d;
DROP POLICY IF EXISTS "Admins can view all wallpapers" ON wallpapers_3d;
DROP POLICY IF EXISTS "Admins can insert wallpapers" ON wallpapers_3d;
DROP POLICY IF EXISTS "Admins can update wallpapers" ON wallpapers_3d;
DROP POLICY IF EXISTS "Admins can delete wallpapers" ON wallpapers_3d;

-- Recreate policies with correct column reference
CREATE POLICY "Anyone can view active wallpapers"
  ON wallpapers_3d FOR SELECT
  USING (is_active = true);

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
