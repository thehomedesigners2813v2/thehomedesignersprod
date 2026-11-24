/*
# Keep designer bank details off the public profile

The designers table is readable for verified profiles. Account number,
IFSC and account holder live in a separate table that only the owning
designer can read or change. Checkout reads it with the service role.
*/

CREATE TABLE IF NOT EXISTS public.designer_bank_accounts (
  designer_id uuid PRIMARY KEY REFERENCES public.designers(id) ON DELETE CASCADE,
  account_holder text NOT NULL,
  account_number text NOT NULL,
  ifsc text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT designer_bank_accounts_holder_check CHECK (char_length(btrim(account_holder)) BETWEEN 2 AND 80),
  CONSTRAINT designer_bank_accounts_number_check CHECK (account_number ~ '^[0-9]{9,18}$'),
  CONSTRAINT designer_bank_accounts_ifsc_check CHECK (ifsc ~ '^[A-Z]{4}0[A-Z0-9]{6}$')
);

ALTER TABLE public.designer_bank_accounts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.designer_bank_accounts FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE ON public.designer_bank_accounts TO authenticated;
GRANT ALL ON public.designer_bank_accounts TO service_role;

DROP POLICY IF EXISTS "designer_select_own_bank_account" ON public.designer_bank_accounts;
CREATE POLICY "designer_select_own_bank_account" ON public.designer_bank_accounts
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.designers d
    WHERE d.id = designer_bank_accounts.designer_id AND d.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "designer_insert_own_bank_account" ON public.designer_bank_accounts;
CREATE POLICY "designer_insert_own_bank_account" ON public.designer_bank_accounts
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.designers d
    WHERE d.id = designer_bank_accounts.designer_id AND d.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "designer_update_own_bank_account" ON public.designer_bank_accounts;
CREATE POLICY "designer_update_own_bank_account" ON public.designer_bank_accounts
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.designers d
    WHERE d.id = designer_bank_accounts.designer_id AND d.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.designers d
    WHERE d.id = designer_bank_accounts.designer_id AND d.user_id = auth.uid()
  ));

INSERT INTO public.designer_bank_accounts (designer_id, account_holder, account_number, ifsc)
SELECT id, btrim(bank_account_holder), btrim(bank_account_number), upper(btrim(bank_ifsc))
FROM public.designers
WHERE bank_account_holder IS NOT NULL
  AND bank_account_number IS NOT NULL
  AND bank_ifsc IS NOT NULL
ON CONFLICT (designer_id) DO NOTHING;

ALTER TABLE public.designers
  DROP COLUMN IF EXISTS bank_account_holder,
  DROP COLUMN IF EXISTS bank_account_number,
  DROP COLUMN IF EXISTS bank_ifsc;

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
    awards, verification_status, is_verified, is_active
  )
  VALUES (
    p_user_id, p_name, p_email, p_phone, p_specialization, p_experience,
    p_location, NULLIF(btrim(p_sublocation), ''), p_bio, p_website, p_starting_price,
    p_profile_image, p_business_type, p_google_location_url, p_services,
    p_materials_expertise, p_awards, 'pending', false, true
  )
  RETURNING id INTO new_id;

  INSERT INTO public.designer_bank_accounts (designer_id, account_holder, account_number, ifsc)
  VALUES (new_id, holder, account_number, ifsc);

  RETURN new_id;
END;
$function$;
