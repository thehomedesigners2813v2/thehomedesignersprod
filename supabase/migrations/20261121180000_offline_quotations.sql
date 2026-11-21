ALTER TABLE public.designer_quotes
  ADD COLUMN IF NOT EXISTS quote_type text NOT NULL DEFAULT 'project',
  ADD COLUMN IF NOT EXISTS customer_name text,
  ADD COLUMN IF NOT EXISTS customer_email text,
  ADD COLUMN IF NOT EXISTS customer_phone text,
  ADD COLUMN IF NOT EXISTS customer_address text;

ALTER TABLE public.designer_quotes DROP CONSTRAINT IF EXISTS designer_quotes_quote_type_check;
ALTER TABLE public.designer_quotes
  ADD CONSTRAINT designer_quotes_quote_type_check
  CHECK (quote_type IN ('project', 'offline'));

CREATE OR REPLACE FUNCTION public.notify_on_quotation_submitted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_email text;
  v_customer_name text;
  v_designer_name text;
  v_project_name text;
  v_customer_id uuid;
BEGIN
  IF NEW.project_id IS NULL OR NEW.quote_type = 'offline' THEN
    RETURN NEW;
  END IF;

  SELECT c.user_id, c.project_name
  INTO v_customer_id, v_project_name
  FROM customers c
  WHERE c.id = NEW.project_id;

  SELECT email, COALESCE(raw_user_meta_data->>'full_name', email)
  INTO v_customer_email, v_customer_name
  FROM auth.users
  WHERE id = v_customer_id;

  SELECT name
  INTO v_designer_name
  FROM designers
  WHERE id = NEW.designer_id;

  PERFORM create_notification(
    v_customer_id,
    'customer',
    'New Quotation Received',
    v_designer_name || ' has submitted a quotation for your project "' || v_project_name || '"',
    'quotation_submitted',
    NEW.id,
    'quotation'
  );

  PERFORM queue_email_notification(
    v_customer_email,
    v_customer_name,
    'New Quotation from ' || v_designer_name,
    'Dear ' || v_customer_name || ',

' || v_designer_name || ' has submitted a quotation for your project "' || v_project_name || '".

Quotation Details:
- Total Amount: ₹' || NEW.total_amount::text || '
- Valid Until: ' || COALESCE(NEW.valid_until::text, 'Not specified') || '

Please log in to your dashboard to review the detailed quotation and take the next steps.

Best regards,
The Home Designers Team'
  );

  RETURN NEW;
END;
$$;
