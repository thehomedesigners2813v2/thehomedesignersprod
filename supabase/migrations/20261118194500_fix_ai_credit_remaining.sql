-- Remaining credits are granted minus successful consumption. Failed attempts are not counted.

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

  IF v_period.credits_granted - v_period.credits_consumed < 1 THEN
    RAISE EXCEPTION 'AI_CREDITS_EXHAUSTED';
  END IF;

  UPDATE public.ai_credit_periods SET credits_reserved = credits_reserved + 1, updated_at = now() WHERE id = v_period.id;
  INSERT INTO public.ai_credit_ledger (designer_id, credit_period_id, job_id, event_type, amount, idempotency_key)
  VALUES (p_designer_id, v_period.id, p_job_id, 'reserve', -1, p_idempotency_key)
  RETURNING id INTO v_ledger_id;
  RETURN QUERY SELECT v_period.id, v_ledger_id;
END;
$$;
