/*
# Require a settled bill and a 100% update before completion

A designer can mark a project completed only after the bill total has been
covered by verified payments and a project update records 100% completion.
*/

CREATE OR REPLACE FUNCTION public.prevent_incomplete_project_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total numeric := 0;
  v_received numeric := 0;
  v_has_full_update boolean := false;
  v_reason text := '';
BEGIN
  IF NEW.assignment_status IS DISTINCT FROM 'completed' OR OLD.assignment_status = 'completed' THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(total_amount), 0) INTO v_total
  FROM public.project_bills
  WHERE project_id = NEW.id;

  SELECT COALESCE(SUM(amount), 0) INTO v_received
  FROM public.quote_advance_payments
  WHERE project_id = NEW.id AND status = 'paid';

  v_received := v_received + COALESCE((
    SELECT SUM(amount) FROM public.project_payment_requests
    WHERE project_id = NEW.id AND status = 'paid'
  ), 0);

  SELECT EXISTS (
    SELECT 1 FROM public.project_updates
    WHERE project_id = NEW.id AND completion_percentage >= 100
  ) INTO v_has_full_update;

  IF NOT (v_total > 0 AND v_received + 0.01 >= v_total) THEN
    v_reason := 'the full bill amount has not been received';
  END IF;

  IF NOT v_has_full_update THEN
    v_reason := CASE
      WHEN v_reason = '' THEN 'no project update records 100% completion'
      ELSE v_reason || ' and no project update records 100% completion'
    END;
  END IF;

  IF v_reason <> '' THEN
    RAISE EXCEPTION 'This project cannot be marked completed because %', v_reason;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS prevent_incomplete_project_completion ON public.customers;
CREATE TRIGGER prevent_incomplete_project_completion
  BEFORE UPDATE OF assignment_status ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_incomplete_project_completion();
