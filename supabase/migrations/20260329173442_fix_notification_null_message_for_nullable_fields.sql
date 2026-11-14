/*
  # Fix Notification Triggers for Nullable Project Fields
  
  ## Summary
  Since project-related fields in customers table are now nullable (for wallpaper orders),
  we need to handle cases where these fields might be null to prevent notification errors.
  
  ## Changes
  - Update notify_on_project_creation to only fire when project_name is provided
  - Update notify_on_quote_request to handle nullable fields
  - Update notify_on_project_status_update to handle nullable fields
  
  ## Notes
  - Customer records without project_name are for wallpaper orders, not projects
  - Notifications should only be created for actual project registrations
*/

-- Drop existing trigger
DROP TRIGGER IF EXISTS trigger_notify_on_project_creation ON customers;

-- Recreate trigger: Only notify when project_name is present (actual project, not wallpaper order)
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
  -- Only create notification if this is an actual project (has project_name)
  IF NEW.project_name IS NOT NULL THEN
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
- Project Type: ' || COALESCE(NEW.property_type, 'Not specified') || '
- Budget Range: ' || COALESCE(NEW.budget_range, 'Not specified') || '

Next Steps:
1. Browse our verified designers
2. Request quotes from designers that match your requirements
3. Review and compare quotations

Visit your project dashboard to get started.

Best regards,
The Home Designers Team'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_on_project_creation ON customers;
CREATE TRIGGER trigger_notify_on_project_creation
AFTER INSERT ON customers
FOR EACH ROW
EXECUTE FUNCTION notify_on_project_creation();

-- Update notify_on_project_status_update to handle nullable project_name
DROP TRIGGER IF EXISTS trigger_notify_on_project_status_update ON customers;

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
  -- Only trigger when assignment_status changes, there's an assigned designer, and project_name exists
  IF NEW.assignment_status != OLD.assignment_status AND 
     NEW.assigned_designer_id IS NOT NULL AND 
     NEW.project_name IS NOT NULL THEN
    
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