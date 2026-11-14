/*
# Show how and when a bill payment was received

The bill ledger can be read by the customer and the designer. payment_orders
cannot, because only the payer and admins may select those rows. Copy the
method onto the ledger rows when a payment order is marked paid.
*/

ALTER TABLE public.quote_advance_payments
  ADD COLUMN IF NOT EXISTS payment_method text;

ALTER TABLE public.quote_advance_payments
  DROP CONSTRAINT IF EXISTS quote_advance_payments_payment_method_check;

ALTER TABLE public.quote_advance_payments
  ADD CONSTRAINT quote_advance_payments_payment_method_check
  CHECK (payment_method IS NULL OR payment_method IN ('razorpay', 'upi'));

ALTER TABLE public.project_payment_requests
  ADD COLUMN IF NOT EXISTS payment_method text;

ALTER TABLE public.project_payment_requests
  DROP CONSTRAINT IF EXISTS project_payment_requests_payment_method_check;

ALTER TABLE public.project_payment_requests
  ADD CONSTRAINT project_payment_requests_payment_method_check
  CHECK (payment_method IS NULL OR payment_method IN ('razorpay', 'upi'));

CREATE OR REPLACE FUNCTION public.stamp_bill_payment_method()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'paid' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.purpose = 'quote_advance' THEN
      UPDATE public.quote_advance_payments
      SET payment_method = NEW.method
      WHERE quote_id = NEW.reference_id
        AND status IN ('pending', 'paid');
    ELSIF NEW.purpose = 'project_payment' THEN
      UPDATE public.project_payment_requests
      SET payment_method = NEW.method
      WHERE id = NEW.reference_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS stamp_bill_payment_method ON public.payment_orders;
CREATE TRIGGER stamp_bill_payment_method
  AFTER UPDATE OF status ON public.payment_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.stamp_bill_payment_method();

UPDATE public.quote_advance_payments q
SET payment_method = o.method
FROM public.payment_orders o
WHERE o.purpose = 'quote_advance'
  AND o.reference_id = q.quote_id
  AND o.status = 'paid'
  AND q.status = 'paid'
  AND q.payment_method IS NULL;

UPDATE public.project_payment_requests r
SET payment_method = o.method
FROM public.payment_orders o
WHERE o.id = r.payment_order_id
  AND o.status = 'paid'
  AND r.payment_method IS NULL;
