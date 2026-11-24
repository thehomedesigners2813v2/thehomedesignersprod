/*
# Designer NEFT and RTGS payments

Designers store the account a customer can pay into. Those columns stay
off the public designer profile. A bank payment is confirmed by the
owning designer, who can read the UTR and the uploaded receipt.
*/

ALTER TABLE public.designers
  ADD COLUMN IF NOT EXISTS bank_account_holder text,
  ADD COLUMN IF NOT EXISTS bank_account_number text,
  ADD COLUMN IF NOT EXISTS bank_ifsc text;

ALTER TABLE public.payment_orders
  DROP CONSTRAINT IF EXISTS payment_orders_method_check;

ALTER TABLE public.payment_orders
  ADD CONSTRAINT payment_orders_method_check
  CHECK (method IN ('razorpay', 'upi', 'bank'));

ALTER TABLE public.quote_advance_payments
  DROP CONSTRAINT IF EXISTS quote_advance_payments_payment_method_check;

ALTER TABLE public.quote_advance_payments
  ADD CONSTRAINT quote_advance_payments_payment_method_check
  CHECK (payment_method IS NULL OR payment_method IN ('razorpay', 'upi', 'bank'));

ALTER TABLE public.project_payment_requests
  DROP CONSTRAINT IF EXISTS project_payment_requests_payment_method_check;

ALTER TABLE public.project_payment_requests
  ADD CONSTRAINT project_payment_requests_payment_method_check
  CHECK (payment_method IS NULL OR payment_method IN ('razorpay', 'upi', 'bank'));

CREATE UNIQUE INDEX IF NOT EXISTS payment_orders_active_bank_utr_idx
  ON public.payment_orders (upi_transaction_id)
  WHERE method = 'bank' AND status <> 'rejected' AND upi_transaction_id IS NOT NULL;

DROP POLICY IF EXISTS "designer_select_own_bank_payments" ON public.payment_orders;
CREATE POLICY "designer_select_own_bank_payments" ON public.payment_orders
  FOR SELECT TO authenticated
  USING (
    method = 'bank'
    AND EXISTS (
      SELECT 1 FROM public.designers d
      WHERE d.id = payment_orders.designer_id
        AND d.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "designer_read_own_bank_proofs" ON storage.objects;
CREATE POLICY "designer_read_own_bank_proofs" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'payment-proofs'
    AND EXISTS (
      SELECT 1
      FROM public.payment_orders po
      JOIN public.designers d ON d.id = po.designer_id
      WHERE d.user_id = auth.uid()
        AND po.method = 'bank'
        AND po.upi_screenshot_path = storage.objects.name
    )
  );

DROP FUNCTION IF EXISTS public.register_designer_profile(
  uuid, text, text, text, text, text, integer, text, text, text, text, text, text, text[], text[], text[], text
);

CREATE OR REPLACE FUNCTION public.register_designer_profile(
  p_user_id uuid,
  p_name text,
  p_email text,
  p_specialization text,
  p_location text,
  p_phone text DEFAULT NULL::text,
  p_experience integer DEFAULT 0,
  p_bio text DEFAULT NULL::text,
  p_website text DEFAULT NULL::text,
  p_starting_price text DEFAULT NULL::text,
  p_profile_image text DEFAULT NULL::text,
  p_business_type text DEFAULT NULL::text,
  p_google_location_url text DEFAULT NULL::text,
  p_services text[] DEFAULT '{}'::text[],
  p_materials_expertise text[] DEFAULT '{}'::text[],
  p_awards text[] DEFAULT '{}'::text[],
  p_sublocation text DEFAULT NULL::text,
  p_bank_account_holder text DEFAULT NULL::text,
  p_bank_account_number text DEFAULT NULL::text,
  p_bank_ifsc text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_id uuid;
  holder text := NULLIF(btrim(p_bank_account_holder), '');
  account_number text := NULLIF(btrim(p_bank_account_number), '');
  ifsc text := NULLIF(upper(btrim(p_bank_ifsc)), '');
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'Auth account not found for user_id %', p_user_id;
  END IF;

  IF EXISTS (SELECT 1 FROM designers WHERE user_id = p_user_id) THEN
    RAISE EXCEPTION 'Designer profile already exists for this user';
  END IF;

  IF holder IS NULL OR char_length(holder) < 2 OR char_length(holder) > 80 THEN
    RAISE EXCEPTION 'Enter the account holder name';
  END IF;
  IF account_number IS NULL OR account_number !~ '^[0-9]{9,18}$' THEN
    RAISE EXCEPTION 'Enter the account number using 9 to 18 digits';
  END IF;
  IF ifsc IS NULL OR ifsc !~ '^[A-Z]{4}0[A-Z0-9]{6}$' THEN
    RAISE EXCEPTION 'Enter a valid 11-character IFSC code';
  END IF;

  INSERT INTO designers (
    user_id, name, email, phone, specialization, experience, location, sublocation,
    bio, website, starting_price, profile_image,
    business_type, google_location_url, services, materials_expertise,
    awards, bank_account_holder, bank_account_number, bank_ifsc,
    verification_status, is_verified, is_active
  )
  VALUES (
    p_user_id, p_name, p_email, p_phone, p_specialization, p_experience,
    p_location, NULLIF(btrim(p_sublocation), ''), p_bio, p_website, p_starting_price,
    p_profile_image, p_business_type, p_google_location_url, p_services,
    p_materials_expertise, p_awards, holder, account_number, ifsc,
    'pending', false, true
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.register_designer_profile(
  uuid, text, text, text, text, text, integer, text, text, text, text, text, text, text[], text[], text[], text, text, text, text
) TO anon, authenticated;
