/*
  # Prevent Customer Edits After Quote Acceptance
  
  1. Changes
    - Add RLS policy to prevent customers from updating projects after quote is accepted
    - Creates a helper function to check if a project has an accepted quote
    - Updates existing customer update policies
  
  2. Business Logic
    - Once a customer accepts a quote, they cannot edit the project details
    - This prevents scope creep and maintains the integrity of the quoted work
    - Designers can still update project status and add updates
  
  3. Security
    - Policy ensures data integrity
    - Prevents unauthorized modifications after commitment
*/

-- Create helper function to check if project has accepted quote
CREATE OR REPLACE FUNCTION has_accepted_quote(p_project_id uuid)
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_has_quote boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 
    FROM designer_quotes 
    WHERE project_id = p_project_id 
      AND customer_accepted = true
      AND status = 'accepted'
  ) INTO v_has_quote;
  
  RETURN v_has_quote;
END;
$$;

-- Drop existing customer update policies
DROP POLICY IF EXISTS "Customers can update own projects" ON customers;
DROP POLICY IF EXISTS "Users can update own profile" ON customers;
DROP POLICY IF EXISTS "Customers can update their own records" ON customers;

-- Create new comprehensive update policy for customers
DROP POLICY IF EXISTS "Customers can update own projects before quote acceptance" ON customers;
CREATE POLICY "Customers can update own projects before quote acceptance"
  ON customers
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND NOT has_accepted_quote(id)
  )
  WITH CHECK (
    auth.uid() = user_id
    AND NOT has_accepted_quote(id)
  );

-- Recreate designer update policy to allow them to update assigned projects
DROP POLICY IF EXISTS "Designers can update assigned projects" ON customers;

CREATE POLICY "Designers can update assigned projects"
  ON customers
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM designers
      WHERE designers.user_id = auth.uid()
        AND designers.id = customers.assigned_designer_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM designers
      WHERE designers.user_id = auth.uid()
        AND designers.id = customers.assigned_designer_id
    )
  );

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_designer_quotes_project_accepted 
  ON designer_quotes(project_id, customer_accepted, status) 
  WHERE customer_accepted = true;
