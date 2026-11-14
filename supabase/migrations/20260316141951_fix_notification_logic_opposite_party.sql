/*
  # Fix Notification Logic - Send to Opposite Party Only

  1. Changes
    - Update triggers to send notifications only to the opposite party
    - Customer actions notify designer only
    - Designer actions notify customer only
    - Remove duplicate notifications
    
  2. Fixes
    - Quote request: Only notify designer (not customer)
    - Quotation submitted: Only notify customer (not designer)
    - Quotation accepted: Only notify designer (not customer)
    - Project status update: Only notify customer when designer updates
*/

-- Drop existing triggers
DROP TRIGGER IF EXISTS trigger_notify_on_project_creation ON customers;
DROP TRIGGER IF EXISTS trigger_notify_on_quote_request ON customers;
DROP TRIGGER IF EXISTS trigger_notify_on_quotation_submitted ON designer_quotes;
DROP TRIGGER IF EXISTS trigger_notify_on_quotation_accepted ON designer_quotes;
DROP TRIGGER IF EXISTS trigger_notify_on_project_status_update ON customers;

-- Recreate trigger: When customer creates a project (notify customer only)
CREATE OR REPLACE FUNCTION notify_on_project_creation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_email text;
  v_customer_name text;
BEGIN
  -- Get customer details
  SELECT email, COALESCE(raw_user_meta_data->>'full_name', email)
  INTO v_customer_email, v_customer_name
  FROM auth.users
  WHERE id = NEW.user_id;

  -- Create in-app notification for customer
  PERFORM create_notification(
    NEW.user_id,
    'customer',
    'Project Created Successfully',
    'Your project "' || NEW.project_name || '" has been created. You can now request quotes from designers.',
    'project_created',
    NEW.id,
    'project'
  );

  -- Queue email notification
  PERFORM queue_email_notification(
    v_customer_email,
    v_customer_name,
    'Project Created - ' || NEW.project_name,
    'Dear ' || v_customer_name || ',

Your project "' || NEW.project_name || '" has been successfully created on The Home Designers platform.

Project Details:
- Project Type: ' || NEW.property_type || '
- Budget Range: ' || COALESCE(NEW.budget_range, 'Not specified') || '

Next Steps:
1. Browse our verified designers
2. Request quotes from designers that match your requirements
3. Review and compare quotations

Visit your project dashboard to get started.

Best regards,
The Home Designers Team'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_on_project_creation ON customers;
CREATE TRIGGER trigger_notify_on_project_creation
AFTER INSERT ON customers
FOR EACH ROW
EXECUTE FUNCTION notify_on_project_creation();

-- Recreate trigger: When customer assigns project to designer (notify DESIGNER only)
CREATE OR REPLACE FUNCTION notify_on_quote_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_designer_email text;
  v_designer_name text;
  v_customer_name text;
  v_project_name text;
BEGIN
  -- Only trigger when assigned_designer_id is set for the first time or changes
  IF NEW.assigned_designer_id IS NOT NULL AND 
     (OLD.assigned_designer_id IS NULL OR OLD.assigned_designer_id != NEW.assigned_designer_id) THEN
    
    -- Get designer details
    SELECT d.email, d.name
    INTO v_designer_email, v_designer_name
    FROM designers d
    WHERE d.id = NEW.assigned_designer_id;

    -- Get customer details
    SELECT COALESCE(raw_user_meta_data->>'full_name', email)
    INTO v_customer_name
    FROM auth.users
    WHERE id = NEW.user_id;

    -- Get project name
    v_project_name := NEW.project_name;

    -- Create in-app notification for DESIGNER ONLY
    PERFORM create_notification(
      (SELECT user_id FROM designers WHERE id = NEW.assigned_designer_id),
      'designer',
      'New Quote Request',
      'You have received a quote request from ' || v_customer_name || ' for project "' || v_project_name || '"',
      'quote_request',
      NEW.id,
      'project'
    );

    -- Queue email notification to DESIGNER ONLY
    PERFORM queue_email_notification(
      v_designer_email,
      v_designer_name,
      'New Quote Request - ' || v_project_name,
      'Dear ' || v_designer_name || ',

You have received a new quote request from ' || v_customer_name || ' for their project "' || v_project_name || '".

Project Details:
- Project Type: ' || NEW.property_type || '
- Budget Range: ' || COALESCE(NEW.budget_range, 'Not specified') || '
- Requirements: ' || COALESCE(NEW.requirements, 'Not provided') || '

Please log in to your designer dashboard to review the project details and submit your quotation.

Best regards,
The Home Designers Team'
    );

  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_on_quote_request ON customers;
CREATE TRIGGER trigger_notify_on_quote_request
AFTER UPDATE ON customers
FOR EACH ROW
EXECUTE FUNCTION notify_on_quote_request();

-- Recreate trigger: When designer submits a quotation (notify CUSTOMER only)
CREATE OR REPLACE FUNCTION notify_on_quotation_submitted()
RETURNS TRIGGER
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
  -- Get project and customer details
  SELECT c.user_id, c.project_name
  INTO v_customer_id, v_project_name
  FROM customers c
  WHERE c.id = NEW.project_id;

  -- Get customer details
  SELECT email, COALESCE(raw_user_meta_data->>'full_name', email)
  INTO v_customer_email, v_customer_name
  FROM auth.users
  WHERE id = v_customer_id;

  -- Get designer name
  SELECT name
  INTO v_designer_name
  FROM designers
  WHERE id = NEW.designer_id;

  -- Create in-app notification for CUSTOMER ONLY
  PERFORM create_notification(
    v_customer_id,
    'customer',
    'New Quotation Received',
    v_designer_name || ' has submitted a quotation for your project "' || v_project_name || '"',
    'quotation_submitted',
    NEW.id,
    'quotation'
  );

  -- Queue email notification to CUSTOMER ONLY
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

DROP TRIGGER IF EXISTS trigger_notify_on_quotation_submitted ON designer_quotes;
CREATE TRIGGER trigger_notify_on_quotation_submitted
AFTER INSERT ON designer_quotes
FOR EACH ROW
EXECUTE FUNCTION notify_on_quotation_submitted();

-- Recreate trigger: When customer accepts a quotation (notify DESIGNER only)
CREATE OR REPLACE FUNCTION notify_on_quotation_accepted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_designer_email text;
  v_designer_name text;
  v_customer_name text;
  v_project_name text;
  v_customer_id uuid;
  v_designer_user_id uuid;
BEGIN
  -- Only trigger when customer_accepted changes to true
  IF NEW.customer_accepted = true AND (OLD.customer_accepted IS NULL OR OLD.customer_accepted = false) THEN
    
    -- Get project and customer details
    SELECT c.user_id, c.project_name
    INTO v_customer_id, v_project_name
    FROM customers c
    WHERE c.id = NEW.project_id;

    -- Get customer name
    SELECT COALESCE(raw_user_meta_data->>'full_name', email)
    INTO v_customer_name
    FROM auth.users
    WHERE id = v_customer_id;

    -- Get designer details
    SELECT d.user_id, d.email, d.name
    INTO v_designer_user_id, v_designer_email, v_designer_name
    FROM designers d
    WHERE d.id = NEW.designer_id;

    -- Create in-app notification for DESIGNER ONLY
    PERFORM create_notification(
      v_designer_user_id,
      'designer',
      'Quotation Accepted!',
      v_customer_name || ' has accepted your quotation for project "' || v_project_name || '"',
      'quotation_accepted',
      NEW.id,
      'quotation'
    );

    -- Queue email notification to DESIGNER ONLY
    PERFORM queue_email_notification(
      v_designer_email,
      v_designer_name,
      'Quotation Accepted - ' || v_project_name,
      'Dear ' || v_designer_name || ',

Congratulations! ' || v_customer_name || ' has accepted your quotation for the project "' || v_project_name || '".

Project Amount: ₹' || NEW.total_amount::text || '

You can now begin working on the project. Please coordinate with the customer for the next steps.

Best regards,
The Home Designers Team'
    );

  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_on_quotation_accepted ON designer_quotes;
CREATE TRIGGER trigger_notify_on_quotation_accepted
AFTER UPDATE ON designer_quotes
FOR EACH ROW
EXECUTE FUNCTION notify_on_quotation_accepted();

-- Recreate trigger: When project status is updated (notify CUSTOMER only when designer updates)
CREATE OR REPLACE FUNCTION notify_on_project_status_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_email text;
  v_customer_name text;
  v_designer_name text;
BEGIN
  -- Only trigger when assignment_status changes and there's an assigned designer
  IF NEW.assignment_status != OLD.assignment_status AND NEW.assigned_designer_id IS NOT NULL THEN
    
    -- Get customer details
    SELECT email, COALESCE(raw_user_meta_data->>'full_name', email)
    INTO v_customer_email, v_customer_name
    FROM auth.users
    WHERE id = NEW.user_id;

    -- Get designer name
    SELECT name
    INTO v_designer_name
    FROM designers
    WHERE id = NEW.assigned_designer_id;

    -- Create in-app notification for CUSTOMER ONLY
    PERFORM create_notification(
      NEW.user_id,
      'customer',
      'Project Status Updated',
      'Your project "' || NEW.project_name || '" status has been updated to: ' || NEW.assignment_status,
      'project_status_update',
      NEW.id,
      'project'
    );

    -- Queue email notification for significant status changes
    IF NEW.assignment_status IN ('in_progress', 'completed') THEN
      PERFORM queue_email_notification(
        v_customer_email,
        v_customer_name,
        'Project Status Update - ' || NEW.project_name,
        'Dear ' || v_customer_name || ',

Your project "' || NEW.project_name || '" status has been updated by ' || v_designer_name || '.

New Status: ' || NEW.assignment_status || '

Please log in to your dashboard to view the latest updates and communicate with your designer.

Best regards,
The Home Designers Team'
      );
    END IF;

  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_on_project_status_update ON customers;
CREATE TRIGGER trigger_notify_on_project_status_update
AFTER UPDATE ON customers
FOR EACH ROW
EXECUTE FUNCTION notify_on_project_status_update();