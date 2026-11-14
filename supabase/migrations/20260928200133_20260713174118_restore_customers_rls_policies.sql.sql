/*
  # Restore customers RLS policies and helper functions

  ## Problem
  The customers table has RLS enabled but ZERO policies, so no client can
  INSERT, SELECT, UPDATE, or DELETE any row. Customer registration fails with
  "new row violates row-level security policy for table customers".

  ## Root cause
  The policies and helper functions from earlier migrations are missing from
  the live database — same situation as admin_users.

  ## Fix
  Recreate all customer CRUD policies using auth.uid() ownership checks, plus
  designer/admin read access via recursion-safe SECURITY DEFINER functions.
*/

-- Helper functions for designer access (bypass RLS to avoid recursion)

DROP FUNCTION IF EXISTS is_assigned_designer(uuid) CASCADE;
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
  SELECT id INTO designer_id_val
  FROM designers
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF designer_id_val IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM customers
    WHERE id = customer_id
    AND assigned_designer_id = designer_id_val
  );
END;
$$;
GRANT EXECUTE ON FUNCTION is_assigned_designer(uuid) TO authenticated;

DROP FUNCTION IF EXISTS has_project_share_access(uuid) CASCADE;
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
  SELECT email INTO designer_email_val
  FROM designers
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF designer_email_val IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM project_shares
    WHERE project_id = customer_id
    AND designer_email = designer_email_val
  );
END;
$$;
GRANT EXECUTE ON FUNCTION has_project_share_access(uuid) TO authenticated;

-- Customer CRUD policies (ownership via user_id)

DROP POLICY IF EXISTS "Customers can read own projects" ON customers;
CREATE POLICY "Customers can read own projects"
  ON customers FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Customers can insert own projects" ON customers;
CREATE POLICY "Customers can insert own projects"
  ON customers FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Customers can update own projects" ON customers;
CREATE POLICY "Customers can update own projects"
  ON customers FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Customers can delete own projects" ON customers;
CREATE POLICY "Customers can delete own projects"
  ON customers FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Designer read access (via helper functions — recursion-safe)

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

-- Admin read access (via is_active_admin — already restored)

DROP POLICY IF EXISTS "Admins can view all customers" ON customers;
CREATE POLICY "Admins can view all customers"
  ON customers FOR SELECT
  TO authenticated
  USING (is_active_admin());