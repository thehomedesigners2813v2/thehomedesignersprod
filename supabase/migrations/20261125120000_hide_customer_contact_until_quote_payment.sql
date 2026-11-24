/*
# Hide customer phone and email until the 10% quotation payment

Designers can still read the project name and property details while preparing
a quotation. Phone and email stay hidden until that designer has a quote whose
10% confirmation payment is verified. Customers and admins continue to read
the customers table directly.
*/

CREATE OR REPLACE FUNCTION public.designer_can_access_customer_project(p_customer_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_assigned_designer(p_customer_id)
    OR public.has_project_share_access(p_customer_id)
    OR EXISTS (
      SELECT 1
      FROM public.designers d
      JOIN public.designer_quotes q ON q.designer_id = d.id
      WHERE d.user_id = auth.uid()
        AND q.project_id = p_customer_id
    );
$$;

CREATE OR REPLACE FUNCTION public.designer_can_view_customer_contact(p_customer_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.designers d
    JOIN public.designer_quotes q ON q.designer_id = d.id
    WHERE d.user_id = auth.uid()
      AND q.project_id = p_customer_id
      AND q.payment_status = 'verified'
  );
$$;

REVOKE ALL ON FUNCTION public.designer_can_access_customer_project(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.designer_can_view_customer_contact(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.designer_can_access_customer_project(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.designer_can_view_customer_contact(uuid) TO authenticated;

CREATE OR REPLACE VIEW public.designer_customer_projects
WITH (security_barrier = true, security_invoker = false) AS
SELECT
  c.id,
  c.user_id,
  c.name,
  CASE WHEN public.designer_can_view_customer_contact(c.id) THEN c.email ELSE NULL END AS email,
  CASE WHEN public.designer_can_view_customer_contact(c.id) THEN c.phone ELSE NULL END AS phone,
  c.location,
  c.project_name,
  c.property_type,
  c.project_area,
  c.budget_range,
  c.timeline,
  c.requirements,
  c.preferred_designer,
  c.layout_image_url,
  c.inspiration_links,
  c.room_types,
  c.special_requirements,
  c.status,
  c.created_at,
  c.updated_at,
  c.version,
  c.assigned_designer_id,
  c.assignment_status,
  c.last_modified_by,
  c.work_begin_date,
  c.work_end_date,
  c.per_day_discount,
  c.address,
  c.challenges_solutions,
  c.project_timeline_details,
  c.materials_cost_breakdown,
  c.accepted_quote_id,
  c.activation_status
FROM public.customers c
WHERE public.designer_can_access_customer_project(c.id);

REVOKE ALL ON public.designer_customer_projects FROM PUBLIC, anon;
GRANT SELECT ON public.designer_customer_projects TO authenticated;

DROP POLICY IF EXISTS "Designers can view customer projects" ON public.customers;
DROP POLICY IF EXISTS "Designers can view assigned projects" ON public.customers;
DROP POLICY IF EXISTS "Only verified designers can view assigned projects" ON public.customers;
DROP POLICY IF EXISTS "Verified designers can view assigned projects" ON public.customers;

NOTIFY pgrst, 'reload schema';
