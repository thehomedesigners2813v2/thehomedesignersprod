/*
  # Allow Designers to Read Subscription Management Setting
  
  1. Purpose
    - Allow designers to check if subscription management is enabled
    - Designers need to read this setting to know whether to show the button
    
  2. Changes
    - Add SELECT policy for authenticated users to view subscription_management_enabled setting
    - This is safe because designers only need to know if the feature is enabled/disabled
    
  3. Security
    - Only authenticated users can read this setting
    - Setting itself is controlled by admins (existing UPDATE policy)
*/

-- Add policy for authenticated users to view subscription management setting
DROP POLICY IF EXISTS "Authenticated users can view subscription management setting" ON site_settings;
CREATE POLICY "Authenticated users can view subscription management setting"
  ON site_settings
  FOR SELECT
  TO authenticated
  USING (
    setting_key = 'subscription_management_enabled'
  );
