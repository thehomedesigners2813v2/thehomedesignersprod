CREATE OR REPLACE FUNCTION public.register_designer_profile(
  p_user_id uuid,
  p_name text,
  p_email text,
  p_specialization text,
  p_location text,
  p_phone text DEFAULT NULL,
  p_experience integer DEFAULT 0,
  p_bio text DEFAULT NULL,
  p_website text DEFAULT NULL,
  p_starting_price text DEFAULT NULL,
  p_instagram_url text DEFAULT NULL,
  p_profile_image text DEFAULT NULL,
  p_business_type text DEFAULT NULL,
  p_google_location_url text DEFAULT NULL,
  p_services text[] DEFAULT '{}',
  p_materials_expertise text[] DEFAULT '{}',
  p_awards text[] DEFAULT '{}'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    user_id, name, email, phone, specialization, experience, location,
    bio, website, starting_price, instagram_url, profile_image,
    business_type, google_location_url, services, materials_expertise,
    awards, verification_status, is_verified, is_active
  )
  VALUES (
    p_user_id, p_name, p_email, p_phone, p_specialization, p_experience,
    p_location, p_bio, p_website, p_starting_price, p_instagram_url,
    p_profile_image, p_business_type, p_google_location_url, p_services,
    p_materials_expertise, p_awards, 'pending', false, true
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_designer_profile(uuid, text, text, text, text, text, integer, text, text, text, text, text, text, text, text[], text[], text[]) TO anon, authenticated;
