/*
# Public designer portfolio and paid contact lookup

The customers table is not publicly readable, so a visitor cannot see a
designer's completed projects through a normal query. This function returns
only the project name, type, location, completion date and photographs.

Designer phone and email stay on the designers row for the existing project
and admin screens. The public profile does not request those columns. This
function returns them only to the designer, or to a homeowner whose quotation
for that designer is accepted and whose confirmation payment is verified.
*/

CREATE OR REPLACE FUNCTION public.get_designer_portfolio(p_designer_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH completed AS (
    SELECT
      c.id,
      c.project_name,
      c.property_type,
      c.location,
      COALESCE(c.work_end_date, c.updated_at) AS completion_date,
      c.layout_image_url,
      COALESCE((
        SELECT array_agg(photo)
        FROM (
          SELECT DISTINCT photo
          FROM public.project_updates u
          CROSS JOIN LATERAL unnest(COALESCE(u.photos, ARRAY[]::text[])) AS photo
          WHERE u.project_id = c.id
            AND photo IS NOT NULL
            AND photo <> ''
        ) photos
      ), ARRAY[]::text[]) AS photos
    FROM public.customers c
    WHERE c.assigned_designer_id = p_designer_id
      AND c.assignment_status = 'completed'
    ORDER BY COALESCE(c.work_end_date, c.updated_at) DESC
    LIMIT 5
  ),
  counted AS (
    SELECT count(*)::integer AS total
    FROM public.customers
    WHERE assigned_designer_id = p_designer_id
      AND assignment_status = 'completed'
  )
  SELECT jsonb_build_object(
    'total', (SELECT total FROM counted),
    'projects', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', id,
        'project_name', project_name,
        'property_type', property_type,
        'location', location,
        'completion_date', completion_date,
        'image_url', layout_image_url,
        'photos', to_jsonb(photos)
      ) ORDER BY completion_date DESC)
      FROM completed
    ), '[]'::jsonb)
  );
$function$;

REVOKE ALL ON FUNCTION public.get_designer_portfolio(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_designer_portfolio(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_paid_designer_contact(p_designer_id uuid)
RETURNS TABLE (phone text, email text, starting_price text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.designers d
    WHERE d.id = p_designer_id AND d.user_id = auth.uid()
  ) AND NOT EXISTS (
    SELECT 1
    FROM public.designer_quotes q
    JOIN public.customers c ON c.id = q.project_id
    WHERE q.designer_id = p_designer_id
      AND c.user_id = auth.uid()
      AND q.customer_accepted = true
      AND q.payment_status = 'verified'
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT d.phone, d.email, d.starting_price
  FROM public.designers d
  WHERE d.id = p_designer_id
    AND d.is_active = true;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_paid_designer_contact(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_paid_designer_contact(uuid) TO authenticated;

REVOKE SELECT ON TABLE public.designers FROM anon;
GRANT SELECT (
  id,
  user_id,
  name,
  specialization,
  experience,
  location,
  bio,
  website,
  starting_price,
  profile_image,
  portfolio_images,
  services,
  materials_expertise,
  awards,
  rating,
  total_reviews,
  total_projects,
  is_verified,
  is_active,
  created_at,
  updated_at,
  verification_status,
  rejected_reason,
  verified_at,
  business_type,
  google_location_url,
  instagram_url
) ON TABLE public.designers TO anon;
