/*
# Record the payment method after the quotation ledger row exists

The quotation payment row is created in the same transaction, after the
payment order is marked paid. A deferred trigger copies the method once
that row is present.
*/

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
  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS stamp_bill_payment_method ON public.payment_orders;
CREATE CONSTRAINT TRIGGER stamp_bill_payment_method
  AFTER UPDATE OF status ON public.payment_orders
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.stamp_bill_payment_method();
