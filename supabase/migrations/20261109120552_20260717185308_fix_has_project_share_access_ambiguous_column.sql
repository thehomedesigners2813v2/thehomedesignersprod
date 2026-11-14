DROP FUNCTION IF EXISTS public.has_project_share_access(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_assigned_designer(uuid) CASCADE;

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
