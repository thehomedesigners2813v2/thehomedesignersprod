ALTER TABLE public.designers
  ADD COLUMN IF NOT EXISTS sublocation text;

GRANT SELECT (sublocation) ON TABLE public.designers TO anon;

DROP FUNCTION IF EXISTS public.register_designer_profile(
  uuid, text, text, text, text, text, integer, text, text, text, text, text, text, text[], text[], text[]
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
  p_sublocation text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'Auth account not found for user_id %', p_user_id;
  END IF;

  IF EXISTS (SELECT 1 FROM designers WHERE user_id = p_user_id) THEN
    RAISE EXCEPTION 'Designer profile already exists for this user';
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

  RETURN new_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.register_designer_profile(
  uuid, text, text, text, text, text, integer, text, text, text, text, text, text, text[], text[], text[], text
) TO anon, authenticated;
