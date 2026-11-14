/*
  # Fix Infinite Recursion in customers RLS Policies

  1. Problem
    - "Designers can view assigned projects" policy queries designers table
    - "Designers can view customer projects" policy queries both project_shares and designers
    - These designer table queries can trigger admin checks creating circular dependencies
    - When checking customers access, it checks designers, which checks admin_users

  2. Solution
    - Create SECURITY DEFINER helper functions that bypass RLS
    - These functions will check designer status without triggering RLS policies
    - Replace the subqueries in customers policies with these helper functions

  3. Changes
    - Create helper functions: is_assigned_designer() and has_project_share()
    - Update customers table policies to use these functions
*/

-- Helper function to check if current user is the assigned designer for a customer project
DROP FUNCTION IF EXISTS is_assigned_designer(uuid);
CREATE OR REPLACE FUNCTION is_assigned_designer(customer_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  designer_id_val uuid;
BEGIN
  -- Get the designer ID for the current user without triggering RLS
  SELECT id INTO designer_id_val
  FROM designers
  WHERE user_id = auth.uid()
  LIMIT 1;
  
  IF designer_id_val IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check if this designer is assigned to the customer project
  RETURN EXISTS (
    SELECT 1 FROM customers
    WHERE id = customer_id
    AND assigned_designer_id = designer_id_val
  );
END;
$$;
GRANT EXECUTE ON FUNCTION is_assigned_designer(uuid) TO authenticated;

-- Helper function to check if current user has a project share
DROP FUNCTION IF EXISTS has_project_share_access(uuid);
CREATE OR REPLACE FUNCTION has_project_share_access(customer_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  designer_email_val text;
BEGIN
  -- Get the designer email for the current user without triggering RLS
  SELECT email INTO designer_email_val
  FROM designers
  WHERE user_id = auth.uid()
  LIMIT 1;
  
  IF designer_email_val IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check if there's a project share for this designer
  RETURN EXISTS (
    SELECT 1 FROM project_shares
    WHERE project_id = customer_id
    AND designer_email = designer_email_val
  );
END;
$$;
GRANT EXECUTE ON FUNCTION has_project_share_access(uuid) TO authenticated;

-- Update customers policies to use the helper functions
DROP POLICY IF EXISTS "Designers can view assigned projects" ON customers;
CREATE POLICY "Designers can view assigned projects"
  ON customers FOR SELECT
  TO authenticated
  USING (is_assigned_designer(id));

DROP POLICY IF EXISTS "Designers can view customer projects" ON customers;
CREATE POLICY "Designers can view customer projects"
  ON customers FOR SELECT
  TO authenticated
  USING (has_project_share_access(id));
