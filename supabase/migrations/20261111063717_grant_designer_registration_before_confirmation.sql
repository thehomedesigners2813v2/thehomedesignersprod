-- Designer signup calls register_designer_profile before an email is confirmed,
-- so there is no user session yet. A later migration revoked anon execute on
-- every security-definer function, which blocks that existing signup path.
-- Restore execute on this one function. It still requires a real auth user
-- and rejects a second profile for the same user.

GRANT EXECUTE ON FUNCTION public.register_designer_profile(
  uuid, text, text, text, text, text, integer, text, text, text, text, text, text, text[], text[], text[]
) TO anon, authenticated;
