/*
# Anonymous visitors cannot read designer phone or email

A column-level revoke does not remove a table-level SELECT grant.
This replaces the anonymous table grant with every designers column
except phone and email. Signed-in project, billing and admin screens
keep their existing access. The public profile still loads contact
only through get_paid_designer_contact after a verified confirmation
payment.
*/

REVOKE SELECT ON TABLE public.designers FROM anon;

GRANT SELECT (
  id,
  user_id,
  name,
  specialization,
  experience,
  location,
  bio,
  website,
  starting_price,
  profile_image,
  portfolio_images,
  services,
  materials_expertise,
  awards,
  rating,
  total_reviews,
  total_projects,
  is_verified,
  is_active,
  created_at,
  updated_at,
  verification_status,
  rejected_reason,
  verified_at,
  business_type,
  google_location_url,
  instagram_url
) ON TABLE public.designers TO anon;
