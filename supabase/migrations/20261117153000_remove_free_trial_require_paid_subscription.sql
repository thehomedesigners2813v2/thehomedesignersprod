-- Designers no longer receive a free month.
-- A monthly plan is usable only after it is paid and still inside its end date.
-- Admin plan prices stay in subscription_plans.

CREATE OR REPLACE FUNCTION public.initialize_designer_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  basic_plan_id uuid;
BEGIN
  SELECT id INTO basic_plan_id
  FROM public.subscription_plans
  WHERE name = 'Basic' AND is_active = true
  LIMIT 1;

  INSERT INTO public.designer_subscriptions (
    designer_id,
    subscription_plan_id,
    status,
    trial_start_date,
    trial_end_date,
    subscription_start_date,
    subscription_end_date
  ) VALUES (
    NEW.id,
    basic_plan_id,
    'expired',
    NULL,
    NULL,
    NULL,
    NULL
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_subscription_status(p_designer_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  sub_record public.designer_subscriptions%ROWTYPE;
BEGIN
  SELECT * INTO sub_record
  FROM public.designer_subscriptions
  WHERE designer_id = p_designer_id;

  IF NOT FOUND THEN
    RETURN 'no_subscription';
  END IF;

  IF sub_record.status = 'trial' THEN
    UPDATE public.designer_subscriptions
    SET status = 'expired', updated_at = now()
    WHERE id = sub_record.id;
    RETURN 'expired';
  END IF;

  IF sub_record.status = 'active'
     AND sub_record.subscription_end_date IS NOT NULL
     AND sub_record.subscription_end_date < now() THEN
    UPDATE public.designer_subscriptions
    SET status = 'expired', updated_at = now()
    WHERE id = sub_record.id;
    RETURN 'expired';
  END IF;

  RETURN sub_record.status;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_access_feature(p_designer_id uuid, p_feature text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  sub_status text;
BEGIN
  sub_status := public.check_subscription_status(p_designer_id);
  RETURN sub_status = 'active';
END;
$$;

CREATE OR REPLACE FUNCTION public.can_designer_accept_assignment(p_designer_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_usage record;
BEGIN
  SELECT * INTO v_usage FROM public.get_designer_current_usage(p_designer_id);

  IF v_usage.subscription_status IS NULL OR v_usage.subscription_status <> 'active' THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'subscription_inactive',
      'message', 'A paid monthly subscription is required',
      'status', COALESCE(v_usage.subscription_status, 'no_subscription')
    );
  END IF;

  IF v_usage.quotes_used >= v_usage.max_quotes THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'quota_exceeded',
      'message', 'Designer has reached their monthly quote limit (' || v_usage.quotes_used || '/' || v_usage.max_quotes || ')',
      'plan_name', v_usage.plan_name,
      'max_quotes', v_usage.max_quotes,
      'quotes_used', v_usage.quotes_used,
      'period_end', v_usage.period_end
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'reason', 'ok',
    'message', 'Designer can accept new assignments',
    'plan_name', v_usage.plan_name,
    'max_quotes', v_usage.max_quotes,
    'quotes_used', v_usage.quotes_used,
    'quotes_remaining', v_usage.quotes_remaining,
    'period_end', v_usage.period_end
  );
END;
$$;

UPDATE public.designer_subscriptions
SET status = 'expired',
    trial_end_date = now(),
    updated_at = now()
WHERE status = 'trial';

CREATE OR REPLACE FUNCTION public.reserve_ai_credit(p_designer_id uuid, p_job_id uuid, p_idempotency_key text)
RETURNS TABLE(credit_period_id uuid, ledger_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period public.ai_credit_periods%ROWTYPE;
  v_subscription public.designer_ai_subscriptions%ROWTYPE;
  v_standard public.designer_subscriptions%ROWTYPE;
  v_ledger_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.designers WHERE id = p_designer_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO v_standard
  FROM public.designer_subscriptions
  WHERE designer_id = p_designer_id
    AND status = 'active'
    AND (subscription_end_date IS NULL OR subscription_end_date > now())
  LIMIT 1;
  IF v_standard.id IS NULL THEN RAISE EXCEPTION 'STANDARD_SUBSCRIPTION_REQUIRED'; END IF;

  SELECT * INTO v_subscription
  FROM public.designer_ai_subscriptions
  WHERE designer_id = p_designer_id
    AND status IN ('active','trial')
    AND (subscription_end_date IS NULL OR subscription_end_date > now())
  LIMIT 1;
  IF v_subscription.id IS NULL THEN RAISE EXCEPTION 'AI_SUBSCRIPTION_REQUIRED'; END IF;

  SELECT * INTO v_period FROM public.ai_credit_periods WHERE designer_id = p_designer_id AND period_start <= now() AND period_end > now() FOR UPDATE;
  IF v_period.id IS NULL THEN
    INSERT INTO public.ai_credit_periods (designer_id, ai_subscription_id, period_start, period_end, credits_granted)
    SELECT p_designer_id, v_subscription.id, date_trunc('month', now()), date_trunc('month', now()) + interval '1 month', monthly_credits
    FROM public.ai_subscription_plans WHERE id = v_subscription.ai_plan_id
    RETURNING * INTO v_period;
  END IF;

  IF EXISTS (SELECT 1 FROM public.ai_credit_ledger WHERE idempotency_key = p_idempotency_key) THEN
    SELECT id INTO v_ledger_id FROM public.ai_credit_ledger WHERE idempotency_key = p_idempotency_key;
    RETURN QUERY SELECT v_period.id, v_ledger_id;
    RETURN;
  END IF;

  IF v_period.credits_granted - v_period.credits_reserved - v_period.credits_consumed + v_period.credits_refunded < 1 THEN
    RAISE EXCEPTION 'AI_CREDITS_EXHAUSTED';
  END IF;

  UPDATE public.ai_credit_periods SET credits_reserved = credits_reserved + 1, updated_at = now() WHERE id = v_period.id;
  INSERT INTO public.ai_credit_ledger (designer_id, credit_period_id, job_id, event_type, amount, idempotency_key)
  VALUES (p_designer_id, v_period.id, p_job_id, 'reserve', -1, p_idempotency_key)
  RETURNING id INTO v_ledger_id;
  RETURN QUERY SELECT v_period.id, v_ledger_id;
END;
$$;
