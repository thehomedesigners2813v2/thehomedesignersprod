-- Later copied registration migrations recreate the 17-argument
-- register_designer_profile overload after 20261019191258 dropped it.
-- The app calls the 16-argument function, and PostgREST returns 300
-- when both overloads match. Drop only the legacy overload.

DROP FUNCTION IF EXISTS public.register_designer_profile(
  uuid, text, text, text, text, text, integer, text, text, text, text,
  text, text, text, text[], text[], text[]
);

-- The 5-argument record_quote_payment gives every argument a default, so a
-- 4-argument call matches both overloads. Payment fulfillment calls the
-- 5-argument function. Drop the older 4-argument overload.
DROP FUNCTION IF EXISTS public.record_quote_payment(uuid, text, text, numeric);
