-- A public profile needs an admin approval and a confirmed email.
-- Designers can still read their own row, and admins can still read every row.

CREATE OR REPLACE FUNCTION public.designer_email_confirmed(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE id = p_user_id
      AND email_confirmed_at IS NOT NULL
  );
$$;

REVOKE ALL ON FUNCTION public.designer_email_confirmed(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.designer_email_confirmed(uuid) TO anon, authenticated;

DROP POLICY IF EXISTS "Public can read active designers" ON public.designers;
CREATE POLICY "Public can read active designers"
  ON public.designers
  FOR SELECT
  TO anon, authenticated
  USING (
    is_active = true
    AND verification_status = 'verified'
    AND public.designer_email_confirmed(user_id)
  );
