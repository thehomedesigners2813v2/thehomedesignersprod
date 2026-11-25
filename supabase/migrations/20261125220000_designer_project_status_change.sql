/*
# Let the assigned designer change project status without reading the customer row

Designer select access was removed from customers so phone and email stay
hidden. An update then matches no rows. This function checks the assigned
designer and applies the status change. Finalized still cannot return to
assigned or pending. Design approval stays optional.
*/

CREATE OR REPLACE FUNCTION public.designer_update_project_status(
  p_project_id uuid,
  p_status text,
  p_challenges_solutions text DEFAULT NULL,
  p_project_timeline_details text DEFAULT NULL,
  p_materials_cost_breakdown text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'You must be signed in as the assigned designer';
  END IF;

  IF p_status NOT IN ('assigned', 'pending', 'finalized', 'in_progress', 'completed') THEN
    RAISE EXCEPTION 'That project status is not allowed';
  END IF;

  SELECT c.assignment_status INTO v_current
  FROM public.customers c
  JOIN public.designers d ON d.id = c.assigned_designer_id
  WHERE c.id = p_project_id
    AND d.user_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'You can only update a project assigned to you';
  END IF;

  IF v_current = 'completed' THEN
    RAISE EXCEPTION 'A completed project cannot change status';
  END IF;

  IF v_current IN ('finalized', 'in_progress') AND p_status IN ('assigned', 'pending') THEN
    RAISE EXCEPTION 'A finalized project cannot return to assigned or pending';
  END IF;

  UPDATE public.customers
  SET assignment_status = p_status,
      last_modified_by = auth.uid(),
      challenges_solutions = CASE WHEN p_status = 'completed' THEN p_challenges_solutions ELSE challenges_solutions END,
      project_timeline_details = CASE WHEN p_status = 'completed' THEN p_project_timeline_details ELSE project_timeline_details END,
      materials_cost_breakdown = CASE WHEN p_status = 'completed' THEN p_materials_cost_breakdown ELSE materials_cost_breakdown END
  WHERE id = p_project_id;

  RETURN p_status;
END;
$$;

REVOKE ALL ON FUNCTION public.designer_update_project_status(uuid, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.designer_update_project_status(uuid, text, text, text, text) TO authenticated;
