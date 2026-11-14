/*
  # Block Rejected Designers from All Operations
  
  1. Purpose
    - Ensure rejected designers cannot perform any operations (quotes, projects, etc.)
    - Only verified designers can access and manage platform features
    - Pending designers are also restricted (they can only view their profile)
  
  2. Changes
    - Update all designer-related RLS policies to check for 'verified' status
    - Restrict access to quotes, projects, subscriptions for non-verified designers
    
  3. Security
    - Rejected/pending designers can only view their own profile
    - No other operations are allowed until admin approves
*/

-- Update designer_quotes policies to only allow verified designers
DROP POLICY IF EXISTS "Verified designers can view their quotes" ON designer_quotes;
DROP POLICY IF EXISTS "Verified designers can create quotes" ON designer_quotes;
DROP POLICY IF EXISTS "Verified designers can update their quotes" ON designer_quotes;

DROP POLICY IF EXISTS "Only verified designers can view quotes" ON designer_quotes;
CREATE POLICY "Only verified designers can view quotes"
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

DROP POLICY IF EXISTS "Only verified designers can create quotes" ON designer_quotes;
CREATE POLICY "Only verified designers can create quotes"
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

DROP POLICY IF EXISTS "Only verified designers can update quotes" ON designer_quotes;
CREATE POLICY "Only verified designers can update quotes"
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

-- Update customers (projects) policies
DROP POLICY IF EXISTS "Verified designers can view assigned projects" ON customers;

DROP POLICY IF EXISTS "Only verified designers can view assigned projects" ON customers;
CREATE POLICY "Only verified designers can view assigned projects"
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

-- Update designer_subscriptions policies
DROP POLICY IF EXISTS "Designers can view their subscription" ON designer_subscriptions;

DROP POLICY IF EXISTS "Only verified designers can view subscription" ON designer_subscriptions;
CREATE POLICY "Only verified designers can view subscription"
  ON designer_subscriptions
  FOR SELECT
  TO authenticated
  USING (
    designer_id IN (
      SELECT id FROM designers
      WHERE user_id = auth.uid()
      AND verification_status = 'verified'
    )
  );

-- Update designer_material_prices policies
DROP POLICY IF EXISTS "Designers can view their materials" ON designer_material_prices;
DROP POLICY IF EXISTS "Designers can manage their materials" ON designer_material_prices;

DROP POLICY IF EXISTS "Only verified designers can view materials" ON designer_material_prices;
CREATE POLICY "Only verified designers can view materials"
  ON designer_material_prices
  FOR SELECT
  TO authenticated
  USING (
    designer_id IN (
      SELECT id FROM designers
      WHERE user_id = auth.uid()
      AND verification_status = 'verified'
    )
  );

DROP POLICY IF EXISTS "Only verified designers can manage materials" ON designer_material_prices;
CREATE POLICY "Only verified designers can manage materials"
  ON designer_material_prices
  FOR ALL
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

-- Update project_designs policies
DROP POLICY IF EXISTS "Designers can manage their project designs" ON project_designs;

DROP POLICY IF EXISTS "Only verified designers can manage project designs" ON project_designs;
CREATE POLICY "Only verified designers can manage project designs"
  ON project_designs
  FOR ALL
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
