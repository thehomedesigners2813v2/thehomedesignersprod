/*
# Project payment requests

Designers can ask a customer for the next project payment after the quotation
confirmation. The request is paid through the existing payment_orders checkout.
Only the base amount reduces the bill. The Razorpay processing fee stays a
checkout charge.

fulfill_payment_order gains a project_payment branch. An already-paid order
still returns immediately. A request that is already paid is not credited twice.
*/

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'payment_orders'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%purpose%'
  LOOP
    EXECUTE format('ALTER TABLE public.payment_orders DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.payment_orders
  ADD CONSTRAINT payment_orders_purpose_check
  CHECK (purpose IN (
    'designer_subscription',
    'ai_subscription',
    'wallpaper_order',
    'quote_advance',
    'project_payment'
  ));

CREATE TABLE IF NOT EXISTS public.project_payment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id uuid NOT NULL REFERENCES public.project_bills(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  designer_id uuid REFERENCES public.designers(id) ON DELETE SET NULL,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  note text,
  status text NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested', 'awaiting_review', 'paid', 'cancelled')),
  payment_order_id uuid,
  provider_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_project_payment_requests_project
  ON public.project_payment_requests(project_id);
CREATE INDEX IF NOT EXISTS idx_project_payment_requests_bill
  ON public.project_payment_requests(bill_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_project_payment_requests_one_open
  ON public.project_payment_requests(bill_id)
  WHERE status IN ('requested', 'awaiting_review');

ALTER TABLE public.project_payment_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers can read own project payment requests" ON public.project_payment_requests;
CREATE POLICY "Customers can read own project payment requests"
  ON public.project_payment_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = project_payment_requests.project_id
        AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Designers can read own project payment requests" ON public.project_payment_requests;
CREATE POLICY "Designers can read own project payment requests"
  ON public.project_payment_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.designers d
      WHERE d.id = project_payment_requests.designer_id
        AND d.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can read project payment requests" ON public.project_payment_requests;
CREATE POLICY "Admins can read project payment requests"
  ON public.project_payment_requests FOR SELECT
  TO authenticated
  USING (public.is_active_admin());

CREATE OR REPLACE FUNCTION public.fulfill_payment_order(
  p_payment_order_id uuid,
  p_razorpay_payment_id text DEFAULT NULL,
  p_provider_response jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order public.payment_orders%ROWTYPE;
  v_plan_price numeric;
  v_plan_name text;
  v_plan_billing text;
  v_monthly_credits integer;
  v_designer_sub_id uuid;
  v_ai_sub_id uuid;
  v_start timestamptz := now();
  v_end timestamptz := now() + interval '1 month';
  v_request public.project_payment_requests%ROWTYPE;
  v_received numeric := 0;
  v_bill_total numeric := 0;
  v_customer_user uuid;
  v_designer_user uuid;
  v_project_name text;
BEGIN
  SELECT * INTO v_order FROM public.payment_orders WHERE id = p_payment_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment order not found.';
  END IF;

  IF v_order.status = 'paid' THEN
    RETURN;
  END IF;

  UPDATE public.payment_orders
  SET status = 'paid',
      razorpay_payment_id = COALESCE(p_razorpay_payment_id, razorpay_payment_id),
      paid_at = now(),
      updated_at = now(),
      metadata = CASE WHEN p_provider_response IS NULL THEN metadata
                      ELSE metadata || jsonb_build_object('provider_response', p_provider_response) END
  WHERE id = v_order.id;

  IF v_order.purpose = 'designer_subscription' THEN
    SELECT price, name, billing_period INTO v_plan_price, v_plan_name, v_plan_billing
    FROM public.subscription_plans WHERE id = v_order.reference_id;

    SELECT id INTO v_designer_sub_id FROM public.designer_subscriptions
    WHERE designer_id = v_order.designer_id LIMIT 1;

    IF v_designer_sub_id IS NULL THEN
      INSERT INTO public.designer_subscriptions
        (designer_id, subscription_plan_id, status, subscription_start_date, subscription_end_date,
         trial_start_date, trial_end_date, auto_renew)
      VALUES
        (v_order.designer_id, v_order.reference_id, 'active', v_start, v_end,
         v_start, v_start, true)
      RETURNING id INTO v_designer_sub_id;
    ELSE
      UPDATE public.designer_subscriptions
      SET subscription_plan_id = v_order.reference_id,
          status = 'active',
          subscription_start_date = v_start,
          subscription_end_date = v_end,
          updated_at = now()
      WHERE id = v_designer_sub_id;
    END IF;

    INSERT INTO public.subscription_payments
      (designer_subscription_id, amount, currency, payment_method, payment_gateway, transaction_id,
       payment_status, payment_date, billing_period_start, billing_period_end, metadata)
    VALUES
      (v_designer_sub_id, v_order.base_amount, v_order.currency,
       CASE WHEN v_order.method = 'upi' THEN 'upi' ELSE 'razorpay' END,
       v_order.method,
       COALESCE(p_razorpay_payment_id, v_order.upi_transaction_id, v_order.id::text),
       'completed', now(), v_start, v_end,
       jsonb_build_object('payment_order_id', v_order.id, 'plan_name', v_plan_name,
                          'billing_period', v_plan_billing, 'fee_amount', v_order.fee_amount,
                          'total_amount', v_order.total_amount));

  ELSIF v_order.purpose = 'ai_subscription' THEN
    SELECT monthly_credits INTO v_monthly_credits
    FROM public.ai_subscription_plans WHERE id = v_order.reference_id;

    SELECT id INTO v_ai_sub_id FROM public.designer_ai_subscriptions
    WHERE designer_id = v_order.designer_id LIMIT 1;

    IF v_ai_sub_id IS NULL THEN
      INSERT INTO public.designer_ai_subscriptions
        (designer_id, ai_plan_id, status, subscription_start_date, subscription_end_date, auto_renew, payment_provider)
      VALUES
        (v_order.designer_id, v_order.reference_id, 'active', v_start, v_end, true, v_order.method)
      RETURNING id INTO v_ai_sub_id;
    ELSE
      UPDATE public.designer_ai_subscriptions
      SET ai_plan_id = v_order.reference_id,
          status = 'active',
          subscription_start_date = v_start,
          subscription_end_date = v_end,
          payment_provider = v_order.method,
          updated_at = now()
      WHERE id = v_ai_sub_id;
    END IF;

    INSERT INTO public.ai_credit_periods
      (designer_id, ai_subscription_id, period_start, period_end,
       credits_granted, credits_reserved, credits_consumed, credits_refunded)
    VALUES
      (v_order.designer_id, v_ai_sub_id, v_start, v_end, COALESCE(v_monthly_credits, 0), 0, 0, 0);

  ELSIF v_order.purpose = 'wallpaper_order' THEN
    UPDATE public.wallpaper_orders
    SET payment_status = 'completed',
        payment_method = v_order.method
    WHERE id = v_order.reference_id;

  ELSIF v_order.purpose = 'quote_advance' THEN
    PERFORM public.record_quote_payment(
      v_order.reference_id,
      v_order.razorpay_order_id,
      COALESCE(p_razorpay_payment_id, v_order.razorpay_payment_id),
      v_order.base_amount,
      p_provider_response
    );

  ELSIF v_order.purpose = 'project_payment' THEN
    SELECT * INTO v_request
    FROM public.project_payment_requests
    WHERE id = v_order.reference_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Payment request not found.';
    END IF;

    IF v_request.status <> 'paid' THEN
      IF abs(v_request.amount - v_order.base_amount) > 0.01 THEN
        RAISE EXCEPTION 'Payment amount does not match the request.';
      END IF;

      UPDATE public.project_payment_requests
      SET status = 'paid',
          paid_at = now(),
          payment_order_id = v_order.id,
          provider_reference = COALESCE(p_razorpay_payment_id, v_order.upi_transaction_id),
          updated_at = now()
      WHERE id = v_request.id;

      SELECT COALESCE(SUM(amount), 0) INTO v_received
      FROM public.quote_advance_payments
      WHERE project_id = v_request.project_id
        AND status = 'paid';

      SELECT v_received + COALESCE(SUM(amount), 0) INTO v_received
      FROM public.project_payment_requests
      WHERE project_id = v_request.project_id
        AND status = 'paid';

      SELECT total_amount INTO v_bill_total
      FROM public.project_bills
      WHERE id = v_request.bill_id;

      UPDATE public.project_bills
      SET status = CASE
            WHEN v_received + 0.01 >= COALESCE(v_bill_total, 0) THEN 'paid'
            WHEN v_received > 0 THEN 'partially_paid'
            ELSE status
          END,
          updated_at = now()
      WHERE id = v_request.bill_id;

      SELECT c.user_id, c.project_name INTO v_customer_user, v_project_name
      FROM public.customers c
      WHERE c.id = v_request.project_id;

      SELECT d.user_id INTO v_designer_user
      FROM public.designers d
      WHERE d.id = v_request.designer_id;

      IF v_customer_user IS NOT NULL THEN
        PERFORM public.create_notification(
          v_customer_user,
          'customer',
          'Payment added to your bill',
          'Your payment of Rs ' || trim(to_char(v_request.amount, 'FM999999990.00'))
            || ' for "' || COALESCE(v_project_name, 'your project') || '" has been applied to the bill.',
          'project_payment_received',
          v_request.project_id,
          'bill'
        );
      END IF;

      IF v_designer_user IS NOT NULL THEN
        PERFORM public.create_notification(
          v_designer_user,
          'designer',
          'Project payment received',
          'A payment of Rs ' || trim(to_char(v_request.amount, 'FM999999990.00'))
            || ' for "' || COALESCE(v_project_name, 'the project') || '" has been applied to the bill.',
          'project_payment_received',
          v_request.project_id,
          'bill'
        );
      END IF;
    END IF;
  END IF;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.fulfill_payment_order(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fulfill_payment_order(uuid, text, jsonb) TO service_role;
