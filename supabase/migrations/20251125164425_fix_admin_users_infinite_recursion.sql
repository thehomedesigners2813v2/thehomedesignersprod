/*
  # Fix Infinite Recursion in admin_users RLS Policies

  1. Problem
    - The admin_users table has RLS policies that query the admin_users table itself
    - This creates infinite recursion when checking permissions
    - Policies: "Admins can view admin users" and "Only super admins can manage admin users"

  2. Solution
    - Create a SECURITY DEFINER function to check admin status without triggering RLS
    - Update the RLS policies to use this function instead of direct queries
    - The function bypasses RLS by using SECURITY DEFINER with search_path set

  3. Changes
    - Create `is_active_admin()` function to check if current user is an active admin
    - Create `is_super_admin()` function to check if current user is a super admin
    - Drop and recreate problematic policies using these functions
*/

-- Drop the problematic policies first
DROP POLICY IF EXISTS "Admins can view admin users" ON admin_users;
DROP POLICY IF EXISTS "Only super admins can manage admin users" ON admin_users;

-- Create helper function to check if user is an active admin (bypasses RLS)
CREATE OR REPLACE FUNCTION is_active_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admin_users
    WHERE user_id = auth.uid()
    AND is_active = true
  );
END;
$$;

-- Create helper function to check if user is a super admin (bypasses RLS)
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admin_users
    WHERE user_id = auth.uid()
    AND role = 'super_admin'
    AND is_active = true
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION is_active_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION is_super_admin() TO authenticated;

-- Recreate the policies using the helper functions (no more recursion)
DROP POLICY IF EXISTS "Admins can view admin users" ON admin_users;
CREATE POLICY "Admins can view admin users"
  ON admin_users FOR SELECT
  TO authenticated
  USING (is_active_admin());

DROP POLICY IF EXISTS "Super admins can manage admin users" ON admin_users;
CREATE POLICY "Super admins can manage admin users"
  ON admin_users
  FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());
