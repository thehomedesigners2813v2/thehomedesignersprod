/*
  # Fix Site Settings RLS for Admin Read Access
  
  1. Issue
    - Current SELECT policy only allows viewing settings where is_active = true
    - When admin disables subscription management, they can't read it on refresh
    - This causes the toggle to always appear as disabled after refresh
    
  2. Solution
    - Add a new SELECT policy for admin users to view ALL site settings
    - This allows admins to read settings regardless of is_active status
    
  3. Security
    - Only authenticated admin users can read all settings
    - Public users can still only see active settings
*/

-- Add policy for admin users to view all site settings
DROP POLICY IF EXISTS "Admin users can view all site settings" ON site_settings;
CREATE POLICY "Admin users can view all site settings"
  ON site_settings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.is_active = true
    )
  );
