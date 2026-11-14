/*
  # Add RLS Policies for Designer Verification System
  
  1. Purpose
    - Block pending/rejected designers from accessing the platform
    - Only allow verified designers to view and manage projects, quotes, etc.
    - Allow admins to view and manage all designer verification statuses
    
  2. Policies
    - Designers can only read their own profile (any status)
    - Only verified designers can access projects, quotes, subscriptions
    - Admins can update verification_status
    - Designers cannot change their own verification_status
    
  3. Security
    - Pending designers can still view their profile to see their status
    - But they cannot access any other platform features
*/

-- Drop existing designer SELECT policies if they don't check verification_status
DROP POLICY IF EXISTS "Designers can view their own profile" ON designers;
DROP POLICY IF EXISTS "Designers can update own profile" ON designers;
DROP POLICY IF EXISTS "Verified designers can update own profile" ON designers;
DROP POLICY IF EXISTS "Admins can update designer verification status" ON designers;

-- Allow designers to view their own profile (any verification status)
CREATE POLICY "Designers can view their own profile"
  ON designers
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
  );

-- Only verified designers can update their profile (excluding verification_status)
CREATE POLICY "Verified designers can update own profile"
  ON designers
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid() 
    AND verification_status = 'verified'
  )
  WITH CHECK (
    user_id = auth.uid() 
    AND verification_status = 'verified'
  );

-- Admin users can update any designer's verification_status
DROP POLICY IF EXISTS "Admins can update designer verification status" ON designers;
CREATE POLICY "Admins can update designer verification status"
  ON designers
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.is_active = true
    )
  );

-- Restrict designer_quotes access to verified designers only
DROP POLICY IF EXISTS "Designers can view their quotes" ON designer_quotes;
DROP POLICY IF EXISTS "Verified designers can view their quotes" ON designer_quotes;
DROP POLICY IF EXISTS "Designers can create quotes" ON designer_quotes;
DROP POLICY IF EXISTS "Verified designers can create quotes" ON designer_quotes;
DROP POLICY IF EXISTS "Designers can update their quotes" ON designer_quotes;
DROP POLICY IF EXISTS "Verified designers can update their quotes" ON designer_quotes;

CREATE POLICY "Verified designers can view their quotes"
  ON designer_quotes
  FOR SELECT
  TO authenticated
  USING (
    designer_id IN (
      SELECT id FROM designers
      WHERE user_id = auth.uid()
      AND verification_status = 'verified'
    )
  );

DROP POLICY IF EXISTS "Verified designers can create quotes" ON designer_quotes;
CREATE POLICY "Verified designers can create quotes"
  ON designer_quotes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    designer_id IN (
      SELECT id FROM designers
      WHERE user_id = auth.uid()
      AND verification_status = 'verified'
    )
  );

DROP POLICY IF EXISTS "Verified designers can update their quotes" ON designer_quotes;
CREATE POLICY "Verified designers can update their quotes"
  ON designer_quotes
  FOR UPDATE
  TO authenticated
  USING (
    designer_id IN (
      SELECT id FROM designers
      WHERE user_id = auth.uid()
      AND verification_status = 'verified'
    )
  )
  WITH CHECK (
    designer_id IN (
      SELECT id FROM designers
      WHERE user_id = auth.uid()
      AND verification_status = 'verified'
    )
  );

-- Restrict customers (projects) access to verified designers only
DROP POLICY IF EXISTS "Verified designers can view assigned projects" ON customers;

CREATE POLICY "Verified designers can view assigned projects"
  ON customers
  FOR SELECT
  TO authenticated
  USING (
    assigned_designer_id IN (
      SELECT id FROM designers
      WHERE user_id = auth.uid()
      AND verification_status = 'verified'
    )
  );
