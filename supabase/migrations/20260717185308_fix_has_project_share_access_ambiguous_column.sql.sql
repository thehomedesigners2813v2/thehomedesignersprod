-- Fix: rename parameter from `customer_id` to `p_customer_id` to avoid
-- ambiguous column reference with project_shares.customer_id.
-- The old function threw "column reference customer_id is ambiguous" inside
-- the EXISTS subquery, which caused RLS to error out the designer's SELECT
-- on the customers table entirely (policies are OR-ed, one error fails all).

-- Drop both functions with CASCADE (also drops dependent RLS policies)
DROP FUNCTION IF EXISTS public.has_project_share_access(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_assigned_designer(uuid) CASCADE;

-- Recreate with disambiguated parameter names
DROP FUNCTION IF EXISTS has_project_share_access(uuid);
CREATE OR REPLACE FUNCTION public.has_project_share_access(p_customer_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    WHERE project_id = p_customer_id
    AND designer_email = designer_email_val
  );
END;
$function$;

DROP FUNCTION IF EXISTS is_assigned_designer(uuid);
CREATE OR REPLACE FUNCTION public.is_assigned_designer(p_customer_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    WHERE id = p_customer_id
    AND assigned_designer_id = designer_id_val
  );
END;
$function$;

-- Recreate the RLS policies that were dropped by CASCADE
DROP POLICY IF EXISTS "Designers can view customer projects" ON customers;
CREATE POLICY "Designers can view customer projects"
  ON customers FOR SELECT
  TO authenticated
  USING (has_project_share_access(id));

DROP POLICY IF EXISTS "Designers can view assigned projects" ON customers;
CREATE POLICY "Designers can view assigned projects"
  ON customers FOR SELECT
  TO authenticated
  USING (is_assigned_designer(id));
