/*
# Only an administrator can delete a project after the quotation is confirmed

A homeowner can still delete a project that has no verified confirmation
payment. Once a quotation payment is verified, the homeowner delete policy
no longer matches. An administrator deletes that project through
admin_delete_project, which removes the linked records first.
*/

CREATE OR REPLACE FUNCTION public.project_has_confirmed_quotation(p_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.designer_quotes q
    WHERE q.project_id = p_project_id
      AND q.payment_status = 'verified'
  );
$$;

REVOKE ALL ON FUNCTION public.project_has_confirmed_quotation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.project_has_confirmed_quotation(uuid) TO authenticated;

DROP POLICY IF EXISTS "Customers can delete own projects" ON public.customers;
CREATE POLICY "Customers can delete own projects"
  ON public.customers FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND NOT public.project_has_confirmed_quotation(id)
  );

DROP POLICY IF EXISTS "Admins can delete projects" ON public.customers;
CREATE POLICY "Admins can delete projects"
  ON public.customers FOR DELETE
  TO authenticated
  USING (public.is_active_admin());

CREATE OR REPLACE FUNCTION public.admin_delete_project(p_project_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_active_admin() THEN
    RAISE EXCEPTION 'Only an administrator can delete this project';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.customers WHERE id = p_project_id) THEN
    RAISE EXCEPTION 'Project not found';
  END IF;

  UPDATE public.designer_quotes
  SET parent_quote_id = NULL
  WHERE project_id = p_project_id;

  DELETE FROM public.community_participants
  WHERE customer_id = p_project_id
     OR community_project_id IN (
       SELECT id FROM public.community_projects WHERE source_customer_id = p_project_id
     );

  DELETE FROM public.community_join_requests
  WHERE requester_customer_id = p_project_id
     OR new_customer_id = p_project_id
     OR community_project_id IN (
       SELECT id FROM public.community_projects WHERE source_customer_id = p_project_id
     )
     OR cloned_quote_id IN (
       SELECT id FROM public.designer_quotes WHERE project_id = p_project_id
     );

  DELETE FROM public.community_referral_rewards
  WHERE beneficiary_customer_id = p_project_id;

  DELETE FROM public.community_projects
  WHERE source_customer_id = p_project_id;

  DELETE FROM public.design_furniture
  WHERE design_project_id IN (
    SELECT id FROM public.design_projects WHERE customer_project_id = p_project_id
  );
  DELETE FROM public.design_rooms
  WHERE design_project_id IN (
    SELECT id FROM public.design_projects WHERE customer_project_id = p_project_id
  );
  DELETE FROM public.design_walls
  WHERE design_project_id IN (
    SELECT id FROM public.design_projects WHERE customer_project_id = p_project_id
  );
  DELETE FROM public.design_projects
  WHERE customer_project_id = p_project_id;

  DELETE FROM public.review_responses
  WHERE review_id IN (SELECT id FROM public.reviews WHERE project_id = p_project_id);
  DELETE FROM public.review_votes
  WHERE review_id IN (SELECT id FROM public.reviews WHERE project_id = p_project_id);
  DELETE FROM public.reviews
  WHERE project_id = p_project_id;

  DELETE FROM public.bill_items
  WHERE bill_id IN (SELECT id FROM public.project_bills WHERE project_id = p_project_id);
  DELETE FROM public.bill_versions
  WHERE bill_id IN (SELECT id FROM public.project_bills WHERE project_id = p_project_id);
  DELETE FROM public.project_bills
  WHERE project_id = p_project_id;

  DELETE FROM public.quote_items
  WHERE quote_id IN (SELECT id FROM public.designer_quotes WHERE project_id = p_project_id);
  DELETE FROM public.quote_acceptance_history
  WHERE quote_id IN (SELECT id FROM public.designer_quotes WHERE project_id = p_project_id);
  DELETE FROM public.designer_quotes
  WHERE project_id = p_project_id;

  DELETE FROM public.customer_notification_preferences WHERE customer_id = p_project_id;
  DELETE FROM public.designer_projects_earnings WHERE project_id = p_project_id;
  DELETE FROM public.project_activities WHERE project_id = p_project_id;
  DELETE FROM public.project_assignments WHERE project_id = p_project_id;
  DELETE FROM public.project_designs WHERE project_id = p_project_id;
  DELETE FROM public.project_images WHERE project_id = p_project_id;
  DELETE FROM public.project_shares WHERE project_id = p_project_id;
  DELETE FROM public.project_team_members WHERE project_id = p_project_id;
  DELETE FROM public.project_updates WHERE project_id = p_project_id;
  DELETE FROM public.project_versions WHERE project_id = p_project_id;
  DELETE FROM public.vastu_analyses WHERE project_id = p_project_id;
  DELETE FROM public.wallpaper_orders WHERE customer_id = p_project_id;
  DELETE FROM public.whatsapp_notification_logs
  WHERE customer_id = p_project_id OR project_id = p_project_id;

  DELETE FROM public.customers WHERE id = p_project_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_project(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_project(uuid) TO authenticated;
