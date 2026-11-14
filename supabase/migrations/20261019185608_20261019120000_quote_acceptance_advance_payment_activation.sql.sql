/*
# Quotation Acceptance, Competing Quote Closure, Advance Payment & Project Activation

## Purpose
Make quotation acceptance server-enforced, atomic, and concurrency-safe; close competing
quotations when one is selected; drive advance payment through a dedicated, idempotent
payment record; and only activate the project after the advance payment is verified by
the payment provider. The frontend no longer decides acceptance or project state.

## 1. New tables
- `quote_advance_payments`
  - One row per advance payment attempt for an accepted quotation.
  - `id` (uuid PK), `quote_id` (uuid FK -> designer_quotes ON DELETE CASCADE),
    `project_id` (uuid FK -> customers ON DELETE CASCADE),
    `designer_id` (uuid FK -> designers),
    `customer_user_id` (uuid) — snapshot of the homeowner at creation time,
    `razorpay_order_id` (text, unique), `razorpay_payment_id` (text, nullable, unique where not null),
    `amount` (numeric, advance amount in rupees, NOT NULL),
    `currency` (text, default 'INR'),
    `status` (text: 'pending' | 'paid' | 'failed' | 'cancelled'; default 'pending'),
    `provider_response` (jsonb, raw verified provider response, nullable),
    `failure_reason` (text, nullable),
    `created_at`, `updated_at`, `paid_at` (timestamptz, nullable).
  - Uniqueness on `razorpay_order_id` makes order creation idempotent per order id.
  - A paid payment cannot be re-opened (enforced in `record_quote_payment`).

## 2. Columns added to existing tables
- `customers.accepted_quote_id` (uuid, nullable, FK -> designer_quotes ON DELETE SET NULL)
  — records which quote was selected for this project.
- `customers.activation_status` (text, default 'quoting')
  — explicit project execution state independent of quotation status:
    'quoting' (no quote accepted yet),
    'awaiting_advance' (quote accepted, advance payment pending),
    'active' (advance verified, project started),
    'on_hold' (payment failure / cancellation recovery in progress),
    'completed' (work finished — existing workflow).
  These coexist with the existing `assignment_status` column, which keeps its values
  ('unassigned', 'assigned', 'completed').

## 3. Configurable advance percentage
- `site_settings` gains two new rows seeded here:
    setting_key = 'advance_payment_percent' -> stored in `video_url` as text ('10')
      (reusing the existing flexible key/value site_settings table; parsed as numeric).
    setting_key = 'advance_payment_min_amount' -> '0' (minimum advance in rupees).
- The acceptance/payment functions read these via a helper `get_advance_payment_config()`
  so the percentage is not hardcoded. Defaults to 10% with a 0 minimum if the rows
  are missing or unparseable.

## 4. New / replaced SECURITY DEFINER functions
- `get_advance_payment_config()` -> TABLE(percent numeric, min_amount numeric, terms text)
  Stable helper reading site_settings.
- `accept_quote(p_quote_id uuid, p_feedback text)` -> TABLE(success boolean, project_id uuid, designer_id uuid, advance_amount numeric, accepted_quote_id uuid)
  - Verifies the caller (`auth.uid()`) owns the project linked to the quote.
  - Locks the project row (`SELECT ... FOR UPDATE`) to serialize concurrent accepts.
  - Refuses if `customers.accepted_quote_id` is already set (another quote already won).
  - Refuses if the quote is not in a submittable state (`status='sent'` or 'draft'
    treated as live; 'accepted'/'rejected'/'expired' rejected).
  - Marks the selected quote: `status='accepted'`, `customer_accepted=true`,
    `acceptance_date=now()`, computes and stores `confirmation_amount` from the
    configured advance percent.
  - Sets `customers.accepted_quote_id`, `assigned_designer_id`, `assignment_status='assigned'`,
    `activation_status='awaiting_advance'`.
  - Rejects every other *pending* quote on the same project: `status='rejected'`,
    `rejection_reason='ANOTHER_DESIGNER_SELECTED'`, `rejection_comments` records
    which quote won. Prices, timestamps, items, messages, and history are untouched.
  - Closes competing `project_assignments` rows for the same project whose designer
    is not the selected designer: `status='closed'`.
  - Inserts a row in `quote_acceptance_history` for the accepted quote and each
    rejected competing quote.
  - Notifies the selected designer (congratulations) and each competing designer
    (not selected) via `create_notification`.
  - Returns the advance amount so the caller can display it.

- `record_quote_payment(p_quote_id uuid, p_razorpay_order_id text, p_razorpay_payment_id text, p_amount numeric, p_provider_response jsonb DEFAULT NULL)`
  Replaces the previous minimal version. Now:
  - Locks the quote row `FOR UPDATE`.
  - Idempotent: if a `paid` payment already exists for this quote, returns success
    without inserting a duplicate or re-activating the project.
  - If an existing pending payment for the same `razorpay_order_id` exists, it is
    updated to `paid`; otherwise a new `paid` row is inserted. The
    `razorpay_payment_id` uniqueness guarantees a duplicate webhook for a different
    order cannot create a second paid record.
  - Marks the quote `payment_status='verified'`, `razorpay_payment_id` set,
    `confirmation_amount` finalized.
  - Activates the project ONLY here: `customers.activation_status='active'`,
    `assignment_status='assigned'`, `work_begin_date=now()` (only if not already set).
  - Notifies both designer and customer that the advance is verified and the
    project is active.
  - Refuses if the quote is not the project's `accepted_quote_id` (guards against
    paying a losing/closed quote).

- `cancel_quote_acceptance(p_quote_id uuid, p_reason text)` -> TABLE(success boolean, project_id uuid)
  - Caller must own the project.
  - Only allowed while `activation_status` is 'awaiting_advance' (i.e. before
    payment is verified). Once 'active', cancellation requires the existing
    project workflows.
  - Clears `accepted_quote_id`, resets `activation_status='quoting'`,
    `assignment_status='unassigned'`, `assigned_designer_id=NULL`.
  - Marks the previously-accepted quote back to 'sent' (preserving it for
    re-acceptance) and records history. Does NOT auto-restore competing quotes:
    they remain 'rejected' with reason 'ANOTHER_DESIGNER_SELECTED' until the
    homeowner explicitly reopens the project for new quotations through the
    authorized `reopen_project_for_quotes` function.
  - Notifies the affected designer.

- `reopen_project_for_quotes(p_project_id uuid)` -> TABLE(success boolean)
  - Caller must own the project and `activation_status` must be 'quoting'
    (i.e. after a cancellation, or an admin-authorized reopen).
  - Resets previously-rejected competing quotes (reason 'ANOTHER_DESIGNER_SELECTED')
    back to 'sent' so their designers can be reconsidered. Prices and history
    are preserved; a new history row records the reopen.
  - Reopens `project_assignments` rows that were `closed` back to their prior
    pending state only if the designer has no live quote on the project.
  - Notifies the homeowner.

## 5. RLS policies
- `quote_advance_payments`: homeowners can read payments for their own projects;
  designers can read payments for quotes they own; admins can read all. All writes
  go through SECURITY DEFINER functions (no direct insert/update/delete policy for
  authenticated — deny-by-default).
- New `customers` columns are covered by the existing customer read policy and the
  existing update policy (which already blocks updates after acceptance).

## 6. Compatibility notes
- `has_accepted_quote()` is unchanged; it still returns true when any quote has
  `customer_accepted=true AND status='accepted'`, which matches the new flow.
- `get_customer_quotes()` is unchanged; it already withholds designer contact
  details until `status='accepted' AND payment_status='verified'`.
- `reject_quote()` is unchanged and still available for the homeowner's explicit
  per-quote reject action.
- The old `record_quote_payment` signature is preserved (p_amount defaults, new
  optional p_provider_response) so existing callers keep working.

## 7. Indexes
- `quote_advance_payments(quote_id)`
- `quote_advance_payments(project_id)`
- `quote_advance_payments(designer_id)`
- `quote_advance_payments(status)`
- `customers(activation_status)`
- `customers(accepted_quote_id)`
*/

-- =========================================================================
-- 1. quote_advance_payments table
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.quote_advance_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.designer_quotes(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  designer_id uuid REFERENCES public.designers(id) ON DELETE SET NULL,
  customer_user_id uuid,
  razorpay_order_id text UNIQUE,
  razorpay_payment_id text,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'INR',
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','paid','failed','cancelled')),
  provider_response jsonb,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_quote_advance_payments_quote_id
  ON public.quote_advance_payments(quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_advance_payments_project_id
  ON public.quote_advance_payments(project_id);
CREATE INDEX IF NOT EXISTS idx_quote_advance_payments_designer_id
  ON public.quote_advance_payments(designer_id);
CREATE INDEX IF NOT EXISTS idx_quote_advance_payments_status
  ON public.quote_advance_payments(status);

-- Allow razorpay_payment_id to be unique only when not null
CREATE UNIQUE INDEX IF NOT EXISTS idx_quote_advance_payments_razorpay_payment_id
  ON public.quote_advance_payments(razorpay_payment_id)
  WHERE razorpay_payment_id IS NOT NULL;

ALTER TABLE public.quote_advance_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers can read own project advance payments" ON public.quote_advance_payments;
CREATE POLICY "Customers can read own project advance payments"
  ON public.quote_advance_payments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = quote_advance_payments.project_id AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Designers can read advance payments for their quotes" ON public.quote_advance_payments;
CREATE POLICY "Designers can read advance payments for their quotes"
  ON public.quote_advance_payments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.designers d
      WHERE d.id = quote_advance_payments.designer_id AND d.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can read all advance payments" ON public.quote_advance_payments;
CREATE POLICY "Admins can read all advance payments"
  ON public.quote_advance_payments FOR SELECT
  TO authenticated
  USING (public.is_active_admin());

-- No INSERT/UPDATE/DELETE policies for authenticated: all mutations happen via
-- SECURITY DEFINER functions (record_quote_payment / admin tooling). Deny by default.

-- =========================================================================
-- 2. New columns on customers
-- =========================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='customers' AND column_name='accepted_quote_id'
  ) THEN
    ALTER TABLE public.customers
      ADD COLUMN accepted_quote_id uuid REFERENCES public.designer_quotes(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='customers' AND column_name='activation_status'
  ) THEN
    ALTER TABLE public.customers
      ADD COLUMN activation_status text NOT NULL DEFAULT 'quoting'
      CHECK (activation_status IN ('quoting','awaiting_advance','active','on_hold','completed'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_customers_activation_status
  ON public.customers(activation_status);
CREATE INDEX IF NOT EXISTS idx_customers_accepted_quote_id
  ON public.customers(accepted_quote_id);

-- Backfill activation_status for any pre-existing rows based on their current state
UPDATE public.customers
SET activation_status = CASE
  WHEN assignment_status = 'completed' THEN 'completed'
  WHEN accepted_quote_id IS NOT NULL THEN 'awaiting_advance'
  ELSE 'quoting'
END
WHERE activation_status IS NULL OR activation_status = 'quoting';

-- =========================================================================
-- 3. Configurable advance percentage in site_settings
-- =========================================================================
INSERT INTO public.site_settings (setting_key, video_url, video_title, is_active)
VALUES
  ('advance_payment_percent', '10', 'Advance payment percentage charged on quote acceptance', true),
  ('advance_payment_min_amount', '0', 'Minimum advance amount in rupees (0 = no minimum)', true),
  ('advance_payment_terms', '10% advance payment is required to confirm the designer and start the project. The remaining balance is due per the agreed milestone schedule.', 'Terms shown to the homeowner at checkout', true)
ON CONFLICT DO NOTHING;

-- =========================================================================
-- 4. Helper: read advance payment config
-- =========================================================================
CREATE OR REPLACE FUNCTION public.get_advance_payment_config()
RETURNS TABLE(percent numeric, min_amount numeric, terms text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_percent_text text;
  v_min_text text;
  v_terms text;
  v_percent numeric;
  v_min numeric;
BEGIN
  SELECT video_url INTO v_percent_text FROM public.site_settings
  WHERE setting_key = 'advance_payment_percent' AND is_active = true LIMIT 1;
  SELECT video_url INTO v_min_text FROM public.site_settings
  WHERE setting_key = 'advance_payment_min_amount' AND is_active = true LIMIT 1;
  SELECT video_url INTO v_terms FROM public.site_settings
  WHERE setting_key = 'advance_payment_terms' AND is_active = true LIMIT 1;

  BEGIN
    v_percent := COALESCE(NULLIF(v_percent_text,'')::numeric, 10);
  EXCEPTION WHEN OTHERS THEN v_percent := 10; END;
  BEGIN
    v_min := COALESCE(NULLIF(v_min_text,'')::numeric, 0);
  EXCEPTION WHEN OTHERS THEN v_min := 0; END;

  -- Clamp percent to a sane range
  IF v_percent < 0 THEN v_percent := 0; END IF;
  IF v_percent > 100 THEN v_percent := 100; END IF;

  RETURN QUERY SELECT v_percent, v_min, COALESCE(v_terms, '');
END;
$function$;

-- =========================================================================
-- 5. accept_quote — atomic, concurrency-safe, server-enforced acceptance
-- =========================================================================
CREATE OR REPLACE FUNCTION public.accept_quote(
  p_quote_id uuid,
  p_feedback text DEFAULT NULL
)
RETURNS TABLE(
  success boolean,
  project_id uuid,
  designer_id uuid,
  advance_amount numeric,
  accepted_quote_id uuid
)
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
  v_designer_user_id uuid;
  v_customer_name text;
  v_project_name text;
  v_competing public.designer_quotes%ROWTYPE;
  v_competing_designer_user_id uuid;
BEGIN
  -- Load the quote (no RLS on the function; SECURITY DEFINER bypasses it)
  SELECT q.* INTO v_quote FROM public.designer_quotes q WHERE q.id = p_quote_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quote not found.';
  END IF;

  -- Lock the project row to serialize concurrent acceptances for the same project
  SELECT c.* INTO v_project
  FROM public.customers c
  WHERE c.id = v_quote.project_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Project for this quote not found.';
  END IF;

  -- Ownership check: caller must own the project
  IF v_project.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'You are not authorized to accept a quote for this project.';
  END IF;

  -- The quote must belong to this project
  IF v_quote.project_id IS DISTINCT FROM v_project.id THEN
    RAISE EXCEPTION 'Quote does not belong to this project.';
  END IF;

  -- Refuse if a quote has already been accepted for this project
  IF v_project.accepted_quote_id IS NOT NULL THEN
    RAISE EXCEPTION 'A quotation has already been accepted for this project.';
  END IF;

  -- Quote must be in an actionable state
  IF v_quote.status NOT IN ('sent','draft') OR v_quote.customer_accepted = true THEN
    RAISE EXCEPTION 'This quotation is not in a state that can be accepted (current status: %).', v_quote.status;
  END IF;

  -- Read advance config and compute amount from the agreed quote total
  SELECT percent, min_amount, terms INTO v_advance_percent, v_advance_min, v_terms
  FROM public.get_advance_payment_config();
  v_advance := ROUND((v_quote.total_amount * v_advance_percent) / 100.0, 2);
  IF v_advance < v_advance_min THEN
    v_advance := v_advance_min;
  END IF;

  -- Mark the selected quote accepted with the computed advance amount
  UPDATE public.designer_quotes
  SET status = 'accepted',
      customer_accepted = true,
      acceptance_date = now(),
      customer_feedback = COALESCE(p_feedback, 'Quote accepted'),
      confirmation_amount = v_advance,
      updated_at = now()
  WHERE id = p_quote_id;

  -- Record acceptance on the project, assign designer, advance to awaiting_advance
  UPDATE public.customers
  SET accepted_quote_id = p_quote_id,
      assigned_designer_id = v_quote.designer_id,
      assignment_status = 'assigned',
      activation_status = 'awaiting_advance',
      updated_at = now()
  WHERE id = v_project.id;

  -- History row for the accepted quote
  INSERT INTO public.quote_acceptance_history
    (quote_id, previous_status, new_status, changed_by, changed_by_type, feedback)
  VALUES
    (p_quote_id, v_quote.status, 'accepted', auth.uid(), 'customer', COALESCE(p_feedback, 'Quote accepted'));

  -- Reject every other pending quote on this project with a distinct reason.
  -- Prices, timestamps, items, messages and prior history are NOT modified.
  FOR v_competing IN
    SELECT q.* FROM public.designer_quotes q
    WHERE q.project_id = v_project.id
      AND q.id <> p_quote_id
      AND q.status IN ('sent','draft','changes_requested')
  LOOP
    UPDATE public.designer_quotes
    SET status = 'rejected',
        rejection_reason = 'ANOTHER_DESIGNER_SELECTED',
        rejection_comments = 'Another designer was selected for this project.',
        customer_accepted = false,
        updated_at = now()
    WHERE id = v_competing.id;

    INSERT INTO public.quote_acceptance_history
      (quote_id, previous_status, new_status, changed_by, changed_by_type, feedback)
    VALUES
      (v_competing.id, v_competing.status, 'rejected', auth.uid(), 'customer',
       'Closed automatically: another designer was selected.');

    -- Notify the competing designer
    SELECT d.user_id INTO v_competing_designer_user_id
    FROM public.designers d WHERE d.id = v_competing.designer_id;
    IF v_competing_designer_user_id IS NOT NULL THEN
      PERFORM public.create_notification(
        v_competing_designer_user_id,
        'designer',
        'Quotation Not Selected',
        COALESCE(v_project.project_name, 'A project') || ': the homeowner selected another designer. Your quotation is preserved for reference.',
        'quotation_not_selected',
        v_competing.id,
        'quotation'
      );
    END IF;
  END LOOP;

  -- Close competing project_assignments for designers that were not selected
  UPDATE public.project_assignments
  SET status = 'closed',
      updated_at = now(),
      responded_at = COALESCE(responded_at, now())
  WHERE project_id = v_project.id
    AND designer_id IS DISTINCT FROM v_quote.designer_id
    AND status IN ('pending','accepted');

  -- Notify the selected designer
  SELECT d.user_id INTO v_designer_user_id
  FROM public.designers d WHERE d.id = v_quote.designer_id;
  SELECT COALESCE(raw_user_meta_data->>'full_name', email) INTO v_customer_name
  FROM auth.users WHERE id = v_project.user_id;

  IF v_designer_user_id IS NOT NULL THEN
    PERFORM public.create_notification(
      v_designer_user_id,
      'designer',
      'Quotation Accepted',
      COALESCE(v_customer_name, 'A homeowner') || ' has accepted your quotation for "' || COALESCE(v_project.project_name,'') || '". An advance payment of ' || v_advance::text || ' is now pending to activate the project.',
      'quotation_accepted',
      p_quote_id,
      'quotation'
    );
  END IF;

  RETURN QUERY SELECT true, v_project.id, v_quote.designer_id, v_advance, p_quote_id;
END;
$function$;

-- =========================================================================
-- 6. record_quote_payment — idempotent, activates project only on verified payment
-- =========================================================================
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
  v_customer_user_id uuid;
  v_customer_name text;
  v_project_name text;
BEGIN
  -- Lock the quote row
  SELECT q.* INTO v_quote FROM public.designer_quotes q WHERE q.id = p_quote_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quote not found.';
  END IF;

  -- Idempotent: a paid advance already exists -> no-op success
  SELECT p.* INTO v_payment
  FROM public.quote_advance_payments p
  WHERE p.quote_id = p_quote_id AND p.status = 'paid'
  LIMIT 1;
  IF FOUND THEN
    RETURN;
  END IF;

  -- Lock the project row
  SELECT c.* INTO v_project
  FROM public.customers c
  WHERE c.id = v_quote.project_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Project for this quote not found.';
  END IF;

  -- Guard: this quote must be the project's accepted quote
  IF v_project.accepted_quote_id IS DISTINCT FROM p_quote_id THEN
    RAISE EXCEPTION 'This quotation is not the accepted quotation for its project and cannot be paid.';
  END IF;

  -- Upsert the payment record. Match on order id if present, else create.
  IF p_razorpay_order_id IS NOT NULL THEN
    SELECT p.* INTO v_payment
    FROM public.quote_advance_payments p
    WHERE p.razorpay_order_id = p_razorpay_order_id
    LIMIT 1;
  END IF;

  IF FOUND THEN
    UPDATE public.quote_advance_payments
    SET status = 'paid',
        razorpay_payment_id = COALESCE(p_razorpay_payment_id, razorpay_payment_id),
        provider_response = COALESCE(p_provider_response, provider_response),
        amount = COALESCE(p_amount, amount),
        paid_at = now(),
        updated_at = now()
    WHERE id = v_payment.id;
  ELSE
    INSERT INTO public.quote_advance_payments
      (quote_id, project_id, designer_id, customer_user_id,
       razorpay_order_id, razorpay_payment_id, amount, status,
       provider_response, paid_at)
    VALUES
      (p_quote_id, v_quote.project_id, v_quote.designer_id, v_project.user_id,
       p_razorpay_order_id, p_razorpay_payment_id,
       COALESCE(p_amount, v_quote.confirmation_amount),
       'paid', p_provider_response, now())
    RETURNING * INTO v_payment;
  END IF;

  -- Mark quote payment verified
  UPDATE public.designer_quotes
  SET payment_status = 'verified',
      razorpay_order_id = COALESCE(p_razorpay_order_id, razorpay_order_id),
      razorpay_payment_id = COALESCE(p_razorpay_payment_id, razorpay_payment_id),
      confirmation_amount = COALESCE(p_amount, confirmation_amount),
      updated_at = now()
  WHERE id = p_quote_id;

  -- Activate the project ONLY now
  UPDATE public.customers
  SET activation_status = 'active',
      assignment_status = 'assigned',
      assigned_designer_id = v_quote.designer_id,
      work_begin_date = COALESCE(work_begin_date, now()),
      updated_at = now()
  WHERE id = v_project.id;

  -- Notify both parties
  SELECT d.user_id INTO v_designer_user_id
  FROM public.designers d WHERE d.id = v_quote.designer_id;
  v_customer_user_id := v_project.user_id;
  v_project_name := v_project.project_name;
  SELECT COALESCE(raw_user_meta_data->>'full_name', email) INTO v_customer_name
  FROM auth.users WHERE id = v_customer_user_id;

  IF v_designer_user_id IS NOT NULL THEN
    PERFORM public.create_notification(
      v_designer_user_id,
      'designer',
      'Advance Payment Verified — Project Activated',
      COALESCE(v_customer_name, 'The homeowner') || ' has made the advance payment for "' || COALESCE(v_project_name,'') || '". The project is now active.',
      'project_activated',
      p_quote_id,
      'quotation'
    );
  END IF;

  IF v_customer_user_id IS NOT NULL THEN
    PERFORM public.create_notification(
      v_customer_user_id,
      'customer',
      'Payment Confirmed — Project Activated',
      'Your advance payment has been verified. The project "' || COALESCE(v_project_name,'') || '" is now active and the designer''s contact details are unlocked.',
      'project_activated',
      p_quote_id,
      'quotation'
    );
  END IF;
END;
$function$;

-- =========================================================================
-- 7. cancel_quote_acceptance — allow cancellation only before payment verifies
-- =========================================================================
CREATE OR REPLACE FUNCTION public.cancel_quote_acceptance(
  p_quote_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS TABLE(success boolean, project_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_quote public.designer_quotes%ROWTYPE;
  v_project public.customers%ROWTYPE;
  v_designer_user_id uuid;
BEGIN
  SELECT q.* INTO v_quote FROM public.designer_quotes q WHERE q.id = p_quote_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quote not found.';
  END IF;

  SELECT c.* INTO v_project
  FROM public.customers c
  WHERE c.id = v_quote.project_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Project not found.';
  END IF;

  IF v_project.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'You are not authorized to cancel this quotation.';
  END IF;

  IF v_project.accepted_quote_id IS DISTINCT FROM p_quote_id THEN
    RAISE EXCEPTION 'This quotation is not the currently accepted quotation.';
  END IF;

  -- Only allow cancellation while the advance is still pending
  IF v_project.activation_status NOT IN ('awaiting_advance','on_hold') THEN
    RAISE EXCEPTION 'Cannot cancel an accepted quotation after the advance payment has been verified. Use the project cancellation workflow instead.';
  END IF;

  -- Reset the project to quoting state
  UPDATE public.customers
  SET accepted_quote_id = NULL,
      assigned_designer_id = NULL,
      assignment_status = 'unassigned',
      activation_status = 'quoting',
      updated_at = now()
  WHERE id = v_project.id;

  -- Revert the accepted quote to 'sent' (preserve it for possible re-acceptance)
  UPDATE public.designer_quotes
  SET status = 'sent',
      customer_accepted = false,
      customer_feedback = COALESCE(p_reason, 'Acceptance cancelled by homeowner'),
      updated_at = now()
  WHERE id = p_quote_id;

  INSERT INTO public.quote_acceptance_history
    (quote_id, previous_status, new_status, changed_by, changed_by_type, feedback)
  VALUES
    (p_quote_id, 'accepted', 'sent', auth.uid(), 'customer',
     COALESCE(p_reason, 'Acceptance cancelled by homeowner'));

  -- Notify the affected designer
  SELECT d.user_id INTO v_designer_user_id
  FROM public.designers d WHERE d.id = v_quote.designer_id;
  IF v_designer_user_id IS NOT NULL THEN
    PERFORM public.create_notification(
      v_designer_user_id,
      'designer',
      'Quotation Acceptance Cancelled',
      'The homeowner cancelled the acceptance of your quotation for "' || COALESCE(v_project.project_name,'') || '". No advance payment was collected.',
      'quotation_acceptance_cancelled',
      p_quote_id,
      'quotation'
    );
  END IF;

  RETURN QUERY SELECT true, v_project.id;
END;
$function$;

-- =========================================================================
-- 8. reopen_project_for_quotes — re-enable competing quotes after a cancellation
-- =========================================================================
CREATE OR REPLACE FUNCTION public.reopen_project_for_quotes(p_project_id uuid)
RETURNS TABLE(success boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_project public.customers%ROWTYPE;
  v_quote public.designer_quotes%ROWTYPE;
BEGIN
  SELECT c.* INTO v_project
  FROM public.customers c
  WHERE c.id = p_project_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Project not found.';
  END IF;

  IF v_project.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'You are not authorized to reopen this project.';
  END IF;

  IF v_project.activation_status <> 'quoting' THEN
    RAISE EXCEPTION 'Project is not in a quoting state and cannot be reopened for new quotations.';
  END IF;

  -- Restore competing quotes that were closed because another designer was selected
  FOR v_quote IN
    SELECT q.* FROM public.designer_quotes q
    WHERE q.project_id = p_project_id
      AND q.status = 'rejected'
      AND q.rejection_reason = 'ANOTHER_DESIGNER_SELECTED'
  LOOP
    UPDATE public.designer_quotes
    SET status = 'sent',
        rejection_reason = NULL,
        rejection_comments = NULL,
        customer_accepted = false,
        updated_at = now()
    WHERE id = v_quote.id;

    INSERT INTO public.quote_acceptance_history
      (quote_id, previous_status, new_status, changed_by, changed_by_type, feedback)
    VALUES
      (v_quote.id, 'rejected', 'sent', auth.uid(), 'customer',
       'Reopened for consideration after cancellation.');
  END LOOP;

  -- Reopen closed project_assignments whose designer has no live quote yet
  UPDATE public.project_assignments
  SET status = 'pending',
      updated_at = now()
  WHERE project_id = p_project_id
    AND status = 'closed'
    AND NOT EXISTS (
      SELECT 1 FROM public.designer_quotes q
      WHERE q.project_id = p_project_id
        AND q.designer_id = project_assignments.designer_id
        AND q.status IN ('sent','accepted')
    );

  PERFORM public.create_notification(
    v_project.user_id,
    'customer',
    'Project Reopened for Quotations',
    'Your project "' || COALESCE(v_project.project_name,'') || '" is open for quotations again. Previously closed quotes have been restored for your review.',
    'project_reopened',
    p_project_id,
    'project'
  );

  RETURN QUERY SELECT true;
END;
$function$;

-- =========================================================================
-- 9. update_payment_failure — record a failed/cancelled payment attempt
-- =========================================================================
CREATE OR REPLACE FUNCTION public.update_payment_failure(
  p_quote_id uuid,
  p_razorpay_order_id text,
  p_status text,
  p_failure_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_payment public.quote_advance_payments%ROWTYPE;
  v_project public.customers%ROWTYPE;
BEGIN
  IF p_status NOT IN ('failed','cancelled') THEN
    RAISE EXCEPTION 'p_status must be ''failed'' or ''cancelled''.';
  END IF;

  SELECT p.* INTO v_payment
  FROM public.quote_advance_payments p
  WHERE p.razorpay_order_id = p_razorpay_order_id
  LIMIT 1;

  IF NOT FOUND THEN
    SELECT q.project_id INTO v_project FROM public.designer_quotes q WHERE q.id = p_quote_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Quote not found.'; END IF;

    INSERT INTO public.quote_advance_payments
      (quote_id, project_id, designer_id, customer_user_id,
       razorpay_order_id, amount, status, failure_reason)
    SELECT p_quote_id, q.project_id, q.designer_id, c.user_id,
           p_razorpay_order_id, COALESCE(q.confirmation_amount, 0),
           p_status, p_failure_reason
    FROM public.designer_quotes q
    JOIN public.customers c ON c.id = q.project_id
    WHERE q.id = p_quote_id;
  ELSE
    -- Never downgrade a paid record
    IF v_payment.status = 'paid' THEN
      RETURN;
    END IF;

    UPDATE public.quote_advance_payments
    SET status = p_status,
        failure_reason = p_failure_reason,
        updated_at = now()
    WHERE id = v_payment.id;
  END IF;

  -- Put the project on hold so the UI can offer retry
  SELECT c.* INTO v_project
  FROM public.customers c
  WHERE c.id = (SELECT project_id FROM public.designer_quotes WHERE id = p_quote_id)
  FOR UPDATE;
  IF FOUND AND v_project.activation_status = 'awaiting_advance' THEN
    UPDATE public.customers
    SET activation_status = 'on_hold',
        updated_at = now()
    WHERE id = v_project.id;
  END IF;
END;
$function$;

-- =========================================================================
-- 10. has_accepted_quote — unchanged behavior but kept explicit
-- =========================================================================
-- (No change; the existing definition already matches the new flow.)

-- =========================================================================
-- 11. Grant execute on the new functions to authenticated users
-- =========================================================================
GRANT EXECUTE ON FUNCTION public.accept_quote(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_quote_payment(uuid, text, text, numeric, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_quote_acceptance(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reopen_project_for_quotes(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_payment_failure(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_advance_payment_config() TO authenticated;

-- Notifications table: ensure homeowners/designers can read their own rows
-- (Existing policies may be empty; add safe defaults if missing.)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid = 'public.notifications'::regclass AND polname = 'Users can read own notifications'
  ) THEN
    DROP POLICY IF EXISTS "Users can read own notifications" ON public.notifications;
CREATE POLICY "Users can read own notifications"
      ON public.notifications FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid = 'public.notifications'::regclass AND polname = 'Users can update own notifications'
  ) THEN
    DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications"
      ON public.notifications FOR UPDATE
      TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid = 'public.notifications'::regclass AND polname = 'Users can delete own notifications'
  ) THEN
    DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
CREATE POLICY "Users can delete own notifications"
      ON public.notifications FOR DELETE
      TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;
