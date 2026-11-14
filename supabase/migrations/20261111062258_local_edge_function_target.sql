-- Wallpaper receipt emails call an Edge Function. The previous function
-- always used the hosted project URL. Optional site_settings rows let a
-- local database call its own API instead. When those rows are absent,
-- the hosted URL and its public anon key are unchanged.

CREATE OR REPLACE FUNCTION send_wallpaper_order_receipt_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_email text;
  v_customer_user_id uuid;
  v_function_base text;
  v_anon_key text;
  v_request_id bigint;
BEGIN
  SELECT video_url INTO v_function_base
  FROM site_settings
  WHERE setting_key = 'edge_function_base_url' AND is_active = true
  LIMIT 1;

  SELECT video_url INTO v_anon_key
  FROM site_settings
  WHERE setting_key = 'edge_function_anon_key' AND is_active = true
  LIMIT 1;

  IF v_function_base IS NULL OR v_function_base = '' THEN
    v_function_base := 'https://aqcvftydzrsvahiuurts.supabase.co';
  END IF;

  IF v_anon_key IS NULL OR v_anon_key = '' THEN
    v_anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFxY3ZmdHlkenJzdmFoaXV1cnRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkzMjU1MjksImV4cCI6MjA2NDkwMTUyOX0.Jyl2e4RkuuutTZ3ZnkwPir-fvKMV6alAF87xSJmpinc';
  END IF;

  SELECT user_id INTO v_customer_user_id
  FROM customers
  WHERE id = NEW.customer_id;

  IF v_customer_user_id IS NOT NULL THEN
    SELECT email INTO v_customer_email
    FROM auth.users
    WHERE id = v_customer_user_id;
  END IF;

  IF v_customer_email IS NOT NULL AND v_customer_email != '' THEN
    SELECT net.http_post(
      url := v_function_base || '/functions/v1/send-order-receipt-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_anon_key
      ),
      body := jsonb_build_object(
        'orderId', NEW.id::text,
        'customerEmail', v_customer_email,
        'customerName', NEW.customer_name,
        'customerPhone', NEW.customer_phone,
        'customerAddress', NEW.customer_address,
        'wallSizeLength', NEW.wall_size_length,
        'wallSizeHeight', NEW.wall_size_height,
        'wallUnit', NEW.wall_unit,
        'wallpaperType', NEW.wallpaper_type,
        'ratePerSqft', NEW.rate_per_sqft,
        'totalAreaSqft', NEW.total_area_sqft,
        'totalAmount', NEW.total_amount,
        'advanceAmount', NEW.advance_amount,
        'orderDate', NEW.order_date::text
      )
    ) INTO v_request_id;
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to send order receipt email for order %: % (SQLSTATE: %)',
      NEW.id, SQLERRM, SQLSTATE;
    RETURN NEW;
END;
$$;
