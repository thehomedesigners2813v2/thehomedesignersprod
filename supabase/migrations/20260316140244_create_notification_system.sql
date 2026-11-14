/*
  # Create Comprehensive Notification System

  1. New Tables
    - `notifications`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `user_type` (text) - 'customer' or 'designer'
      - `title` (text) - notification title
      - `message` (text) - notification message
      - `type` (text) - notification type (quote_request, quote_submitted, quote_accepted, project_update, etc.)
      - `reference_id` (uuid) - id of related record (project_id, quote_id, etc.)
      - `reference_type` (text) - type of reference (project, quotation, etc.)
      - `is_read` (boolean, default false)
      - `created_at` (timestamptz)
    
    - `email_notifications`
      - `id` (uuid, primary key)
      - `recipient_email` (text)
      - `recipient_name` (text)
      - `subject` (text)
      - `body` (text)
      - `status` (text) - 'pending', 'sent', 'failed'
      - `sent_at` (timestamptz)
      - `error_message` (text)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Users can only view their own notifications
    - Users can update their own notifications (mark as read)
    - Email notifications are managed by system

  3. Functions
    - Function to create notification for user
    - Function to send email notification
    - Triggers for various events

  4. Important Notes
    - Notifications are created for key events in the project/quote lifecycle
    - Email notifications are queued and can be processed by an edge function
    - Real-time subscriptions enabled for instant notifications
*/

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_type text NOT NULL CHECK (user_type IN ('customer', 'designer', 'admin')),
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL,
  reference_id uuid,
  reference_type text,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create email notifications table
CREATE TABLE IF NOT EXISTS email_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_email text NOT NULL,
  recipient_name text,
  subject text NOT NULL,
  body text NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  sent_at timestamptz,
  error_message text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for notifications
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "System can insert notifications" ON notifications;
CREATE POLICY "System can insert notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS Policies for email_notifications (admin/system only)
DROP POLICY IF EXISTS "Only system can manage email notifications" ON email_notifications;
CREATE POLICY "Only system can manage email notifications"
  ON email_notifications FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_email_notifications_status ON email_notifications(status);

-- Function to create notification
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id uuid,
  p_user_type text,
  p_title text,
  p_message text,
  p_type text,
  p_reference_id uuid DEFAULT NULL,
  p_reference_type text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notification_id uuid;
BEGIN
  INSERT INTO notifications (
    user_id,
    user_type,
    title,
    message,
    type,
    reference_id,
    reference_type
  ) VALUES (
    p_user_id,
    p_user_type,
    p_title,
    p_message,
    p_type,
    p_reference_id,
    p_reference_type
  )
  RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$;

-- Function to queue email notification
CREATE OR REPLACE FUNCTION queue_email_notification(
  p_recipient_email text,
  p_recipient_name text,
  p_subject text,
  p_body text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email_id uuid;
BEGIN
  INSERT INTO email_notifications (
    recipient_email,
    recipient_name,
    subject,
    body,
    status
  ) VALUES (
    p_recipient_email,
    p_recipient_name,
    p_subject,
    p_body,
    'pending'
  )
  RETURNING id INTO v_email_id;
  
  RETURN v_email_id;
END;
$$;

-- Trigger: When customer creates a project
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

-- Trigger: When customer assigns project to designer (quote request)
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

    -- Create in-app notification for designer
    PERFORM create_notification(
      (SELECT user_id FROM designers WHERE id = NEW.assigned_designer_id),
      'designer',
      'New Quote Request',
      'You have received a quote request from ' || v_customer_name || ' for project "' || v_project_name || '"',
      'quote_request',
      NEW.id,
      'project'
    );

    -- Create in-app notification for customer
    PERFORM create_notification(
      NEW.user_id,
      'customer',
      'Quote Request Sent',
      'Your quote request has been sent to ' || v_designer_name || ' for project "' || v_project_name || '"',
      'quote_request_sent',
      NEW.id,
      'project'
    );

    -- Queue email notification to designer
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

-- Trigger: When designer submits a quotation
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

  -- Create in-app notification for customer
  PERFORM create_notification(
    v_customer_id,
    'customer',
    'New Quotation Received',
    v_designer_name || ' has submitted a quotation for your project "' || v_project_name || '"',
    'quotation_submitted',
    NEW.id,
    'quotation'
  );

  -- Create in-app notification for designer
  PERFORM create_notification(
    NEW.designer_id,
    'designer',
    'Quotation Submitted',
    'Your quotation for project "' || v_project_name || '" has been submitted successfully',
    'quotation_submitted_confirmation',
    NEW.id,
    'quotation'
  );

  -- Queue email notification to customer
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

-- Trigger: When customer accepts a quotation
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

    -- Create in-app notification for designer
    PERFORM create_notification(
      v_designer_user_id,
      'designer',
      'Quotation Accepted!',
      v_customer_name || ' has accepted your quotation for project "' || v_project_name || '"',
      'quotation_accepted',
      NEW.id,
      'quotation'
    );

    -- Create in-app notification for customer
    PERFORM create_notification(
      v_customer_id,
      'customer',
      'Quotation Accepted',
      'You have accepted the quotation from ' || v_designer_name || ' for project "' || v_project_name || '"',
      'quotation_accepted_confirmation',
      NEW.id,
      'quotation'
    );

    -- Queue email notification to designer
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

-- Trigger: When project status is updated
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
  -- Only trigger when assignment_status changes
  IF NEW.assignment_status != OLD.assignment_status THEN
    
    -- Get customer details
    SELECT email, COALESCE(raw_user_meta_data->>'full_name', email)
    INTO v_customer_email, v_customer_name
    FROM auth.users
    WHERE id = NEW.user_id;

    -- Get designer name if assigned
    IF NEW.assigned_designer_id IS NOT NULL THEN
      SELECT name
      INTO v_designer_name
      FROM designers
      WHERE id = NEW.assigned_designer_id;

      -- Create in-app notification for customer
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

  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_on_project_status_update ON customers;
CREATE TRIGGER trigger_notify_on_project_status_update
AFTER UPDATE ON customers
FOR EACH ROW
EXECUTE FUNCTION notify_on_project_status_update();

-- Enable realtime for notifications table
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;