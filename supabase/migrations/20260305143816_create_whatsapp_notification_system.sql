/*
  # WhatsApp Notification System

  1. New Tables
    - `whatsapp_settings`
      - Stores WhatsApp API configuration (provider, API keys, phone number)
      - Only accessible by admins
    
    - `whatsapp_notification_logs`
      - Tracks all WhatsApp notifications sent
      - Stores message content, status, and delivery information
      - Links to projects and customers

    - `customer_notification_preferences`
      - Stores customer preferences for receiving notifications
      - Allows customers to opt-in/opt-out of different notification types

  2. Security
    - Enable RLS on all tables
    - Admin-only access to settings
    - Customers can view their own notification logs
    - Designers can view notification logs for their assigned projects

  3. Notification Types
    - Quote generated
    - Quote accepted
    - Project status update
    - Project update/photo added
    - Team member assigned
    - Project completed
*/

-- WhatsApp Settings Table (Admin only)
CREATE TABLE IF NOT EXISTS whatsapp_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'twilio',
  account_sid text,
  auth_token text,
  from_number text NOT NULL,
  is_enabled boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

ALTER TABLE whatsapp_settings ENABLE ROW LEVEL SECURITY;

-- Only one settings record should exist
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_settings_singleton ON whatsapp_settings ((true));

DROP POLICY IF EXISTS "Admins can read WhatsApp settings" ON whatsapp_settings;
CREATE POLICY "Admins can read WhatsApp settings"
  ON whatsapp_settings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.is_active = true
    )
  );

DROP POLICY IF EXISTS "Admins can insert WhatsApp settings" ON whatsapp_settings;
CREATE POLICY "Admins can insert WhatsApp settings"
  ON whatsapp_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.is_active = true
    )
  );

DROP POLICY IF EXISTS "Admins can update WhatsApp settings" ON whatsapp_settings;
CREATE POLICY "Admins can update WhatsApp settings"
  ON whatsapp_settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.is_active = true
    )
  );

-- Customer Notification Preferences
CREATE TABLE IF NOT EXISTS customer_notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  whatsapp_enabled boolean DEFAULT true,
  notify_quote_generated boolean DEFAULT true,
  notify_quote_accepted boolean DEFAULT true,
  notify_status_update boolean DEFAULT true,
  notify_project_update boolean DEFAULT true,
  notify_team_assigned boolean DEFAULT true,
  notify_project_completed boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(customer_id)
);

ALTER TABLE customer_notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers can view own notification preferences" ON customer_notification_preferences;
CREATE POLICY "Customers can view own notification preferences"
  ON customer_notification_preferences FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Customers can update own notification preferences" ON customer_notification_preferences;
CREATE POLICY "Customers can update own notification preferences"
  ON customer_notification_preferences FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "System can insert notification preferences" ON customer_notification_preferences;
CREATE POLICY "System can insert notification preferences"
  ON customer_notification_preferences FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- WhatsApp Notification Logs
CREATE TABLE IF NOT EXISTS whatsapp_notification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notification_type text NOT NULL,
  phone_number text NOT NULL,
  message_body text NOT NULL,
  status text DEFAULT 'pending',
  provider_message_id text,
  provider_status text,
  error_message text,
  sent_at timestamptz,
  delivered_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE whatsapp_notification_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_project ON whatsapp_notification_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_customer ON whatsapp_notification_logs(customer_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_status ON whatsapp_notification_logs(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_created ON whatsapp_notification_logs(created_at DESC);

DROP POLICY IF EXISTS "Admins can view all notification logs" ON whatsapp_notification_logs;
CREATE POLICY "Admins can view all notification logs"
  ON whatsapp_notification_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.is_active = true
    )
  );

DROP POLICY IF EXISTS "Customers can view own notification logs" ON whatsapp_notification_logs;
CREATE POLICY "Customers can view own notification logs"
  ON whatsapp_notification_logs FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Designers can view logs for assigned projects" ON whatsapp_notification_logs;
CREATE POLICY "Designers can view logs for assigned projects"
  ON whatsapp_notification_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM designers
      JOIN customers ON customers.assigned_designer_id = designers.id
      WHERE designers.user_id = auth.uid()
      AND customers.id = whatsapp_notification_logs.project_id
    )
  );

DROP POLICY IF EXISTS "System can insert notification logs" ON whatsapp_notification_logs;
CREATE POLICY "System can insert notification logs"
  ON whatsapp_notification_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "System can update notification logs" ON whatsapp_notification_logs;
CREATE POLICY "System can update notification logs"
  ON whatsapp_notification_logs FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Function to automatically create notification preferences for new customers
CREATE OR REPLACE FUNCTION create_customer_notification_preferences()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO customer_notification_preferences (
    customer_id,
    user_id
  ) VALUES (
    NEW.id,
    NEW.user_id
  )
  ON CONFLICT (customer_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create notification preferences
DROP TRIGGER IF EXISTS trigger_create_notification_preferences ON customers;
CREATE TRIGGER trigger_create_notification_preferences
  AFTER INSERT ON customers
  FOR EACH ROW
  EXECUTE FUNCTION create_customer_notification_preferences();