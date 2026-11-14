-- Accept and Proceed was marking designer_quotes accepted before any payment
-- existed. Acceptance, designer assignment and competing-quote closure now
-- happen only inside record_quote_payment, which runs after Razorpay
-- signature verification, a verified webhook, or an authorized UPI review.

CREATE OR REPLACE FUNCTION public.accept_quote(p_quote_id uuid, p_feedback text DEFAULT NULL)
RETURNS TABLE(success boolean, project_id uuid, designer_id uuid, advance_amount numeric, accepted_quote_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_quote public.designer_quotes%ROWTYPE;
  v_project public.customers%ROWTYPE;
  v_advance_percent numeric;
  v_advance_min numeric;
  v_advance numeric;
  v_terms text;
BEGIN
  SELECT q.* INTO v_quote FROM public.designer_quotes q WHERE q.id = p_quote_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quote not found.';
  END IF;

  SELECT c.* INTO v_project FROM public.customers c WHERE c.id = v_quote.project_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Project for this quote not found.';
  END IF;

  IF v_project.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'You are not authorized to accept a quote for this project.';
  END IF;

  IF v_quote.payment_status = 'verified' OR v_quote.customer_accepted = true THEN
    RAISE EXCEPTION 'This quotation has already been confirmed.';
  END IF;

  IF v_quote.status NOT IN ('sent', 'draft', 'changes_requested') THEN
    RAISE EXCEPTION 'This quotation is not in a state that can be accepted (current status: %).', v_quote.status;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.designer_quotes q
    WHERE q.project_id = v_project.id
      AND q.id <> p_quote_id
      AND q.payment_status = 'verified'
  ) THEN
    RAISE EXCEPTION 'A quotation has already been confirmed for this project.';
  END IF;

  SELECT cfg.percent, cfg.min_amount, cfg.terms
  INTO v_advance_percent, v_advance_min, v_terms
  FROM public.get_advance_payment_config() cfg;

  v_advance := ROUND((v_quote.total_amount * v_advance_percent) / 100.0, 2);
  IF v_advance < v_advance_min THEN
    v_advance := v_advance_min;
  END IF;
  IF v_advance <= 0 THEN
    RAISE EXCEPTION 'The confirmation amount must be greater than zero.';
  END IF;

  UPDATE public.designer_quotes dq
  SET confirmation_amount = v_advance,
      customer_feedback = COALESCE(p_feedback, dq.customer_feedback),
      updated_at = now()
  WHERE dq.id = p_quote_id;

  IF NOT EXISTS (
    SELECT 1 FROM public.quote_advance_payments p
    WHERE p.quote_id = p_quote_id AND p.status IN ('pending', 'paid')
  ) THEN
    INSERT INTO public.quote_advance_payments
      (quote_id, project_id, designer_id, customer_user_id, amount, status)
    VALUES
      (p_quote_id, v_quote.project_id, v_quote.designer_id, v_project.user_id, v_advance, 'pending');
  ELSE
    UPDATE public.quote_advance_payments p
    SET amount = v_advance, updated_at = now()
    WHERE p.quote_id = p_quote_id AND p.status = 'pending';
  END IF;

  RETURN QUERY SELECT true, v_project.id, v_quote.designer_id, v_advance, NULL::uuid;
END;
$function$;

CREATE OR REPLACE FUNCTION public.record_quote_payment(
  p_quote_id uuid,
  p_razorpay_order_id text DEFAULT NULL,
  p_razorpay_payment_id text DEFAULT NULL,
  p_amount numeric DEFAULT NULL,
  p_provider_response jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_quote public.designer_quotes%ROWTYPE;
  v_project public.customers%ROWTYPE;
  v_payment public.quote_advance_payments%ROWTYPE;
  v_designer_user_id uuid;
  v_customer_name text;
  v_competing public.designer_quotes%ROWTYPE;
  v_competing_designer_user_id uuid;
BEGIN
  SELECT q.* INTO v_quote FROM public.designer_quotes q WHERE q.id = p_quote_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quote not found.';
  END IF;

  IF v_quote.payment_status = 'verified' AND v_quote.customer_accepted = true THEN
    RETURN;
  END IF;

  SELECT c.* INTO v_project FROM public.customers c WHERE c.id = v_quote.project_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Project for this quote not found.';
  END IF;

  IF v_quote.confirmation_amount IS NULL OR v_quote.confirmation_amount <= 0 THEN
    RAISE EXCEPTION 'The confirmation amount has not been prepared.';
  END IF;

  IF p_amount IS NOT NULL AND abs(p_amount - v_quote.confirmation_amount) > 0.01 THEN
    RAISE EXCEPTION 'Payment amount does not match the confirmation amount.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.designer_quotes q
    WHERE q.project_id = v_project.id
      AND q.id <> p_quote_id
      AND q.payment_status = 'verified'
  ) THEN
    RAISE EXCEPTION 'Another quotation for this project is already confirmed.';
  END IF;

  v_payment := NULL;
  IF p_razorpay_order_id IS NOT NULL THEN
    SELECT p.* INTO v_payment FROM public.quote_advance_payments p
    WHERE p.razorpay_order_id = p_razorpay_order_id
    LIMIT 1;
  END IF;

  IF v_payment.id IS NULL THEN
    SELECT p.* INTO v_payment FROM public.quote_advance_payments p
    WHERE p.quote_id = p_quote_id AND p.status = 'pending'
    ORDER BY p.created_at DESC
    LIMIT 1;
  END IF;

  IF v_payment.id IS NOT NULL THEN
    UPDATE public.quote_advance_payments qap
    SET status = 'paid',
        razorpay_order_id = COALESCE(p_razorpay_order_id, qap.razorpay_order_id),
        razorpay_payment_id = COALESCE(p_razorpay_payment_id, qap.razorpay_payment_id),
        provider_response = COALESCE(p_provider_response, qap.provider_response),
        amount = v_quote.confirmation_amount,
        paid_at = now(),
        updated_at = now()
    WHERE qap.id = v_payment.id;
  ELSE
    INSERT INTO public.quote_advance_payments
      (quote_id, project_id, designer_id, customer_user_id, razorpay_order_id, razorpay_payment_id, amount, status, provider_response, paid_at)
    VALUES
      (p_quote_id, v_quote.project_id, v_quote.designer_id, v_project.user_id, p_razorpay_order_id, p_razorpay_payment_id,
       v_quote.confirmation_amount, 'paid', p_provider_response, now());
  END IF;

  UPDATE public.designer_quotes dq
  SET status = 'accepted',
      customer_accepted = true,
      acceptance_date = COALESCE(dq.acceptance_date, now()),
      customer_feedback = COALESCE(dq.customer_feedback, 'Quote accepted after payment verification'),
      payment_status = 'verified',
      razorpay_order_id = COALESCE(p_razorpay_order_id, dq.razorpay_order_id),
      razorpay_payment_id = COALESCE(p_razorpay_payment_id, dq.razorpay_payment_id),
      updated_at = now()
  WHERE dq.id = p_quote_id;

  UPDATE public.customers cu
  SET accepted_quote_id = p_quote_id,
      assigned_designer_id = v_quote.designer_id,
      assignment_status = 'assigned',
      activation_status = 'active',
      work_begin_date = COALESCE(cu.work_begin_date, now()),
      updated_at = now()
  WHERE cu.id = v_project.id;

  INSERT INTO public.quote_acceptance_history (quote_id, previous_status, new_status, changed_by, changed_by_type, feedback)
  VALUES (p_quote_id, v_quote.status, 'accepted', COALESCE(v_project.user_id, auth.uid()), 'customer', 'Accepted after confirmation payment was verified');

  FOR v_competing IN
    SELECT q.* FROM public.designer_quotes q
    WHERE q.project_id = v_project.id AND q.id <> p_quote_id AND q.status IN ('sent', 'draft', 'changes_requested')
  LOOP
    UPDATE public.designer_quotes dq
    SET status = 'rejected',
        rejection_reason = 'ANOTHER_DESIGNER_SELECTED',
        rejection_comments = 'Another designer was selected for this project.',
        customer_accepted = false,
        updated_at = now()
    WHERE dq.id = v_competing.id;

    INSERT INTO public.quote_acceptance_history (quote_id, previous_status, new_status, changed_by, changed_by_type, feedback)
    VALUES (v_competing.id, v_competing.status, 'rejected', COALESCE(v_project.user_id, auth.uid()), 'customer', 'Closed automatically: another designer was selected.');
  END LOOP;

  SELECT d.user_id INTO v_designer_user_id FROM public.designers d WHERE d.id = v_quote.designer_id;
  SELECT COALESCE(u.raw_user_meta_data->>'full_name', u.email) INTO v_customer_name FROM auth.users u WHERE u.id = v_project.user_id;

  IF v_designer_user_id IS NOT NULL THEN
    PERFORM public.create_notification(
      v_designer_user_id, 'designer', 'Advance Payment Verified - Project Activated',
      COALESCE(v_customer_name, 'The homeowner') || ' has paid the confirmation amount for "' || COALESCE(v_project.project_name, '') || '". The quotation is accepted and the project is now active.',
      'project_activated', p_quote_id, 'quotation');
  END IF;

  IF v_project.user_id IS NOT NULL THEN
    PERFORM public.create_notification(
      v_project.user_id, 'customer', 'Payment Confirmed - Quotation Accepted',
      'Your confirmation payment has been verified. The quotation is accepted and the project "' || COALESCE(v_project.project_name, '') || '" is now active.',
      'project_activated', p_quote_id, 'quotation');
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.record_quote_payment(uuid, text, text, numeric, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_quote_payment(uuid, text, text, numeric, jsonb) TO service_role;
