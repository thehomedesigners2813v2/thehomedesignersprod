/*
  # Designer Deals and Admin System

  1. New Tables
    - `admin_users` - Store admin user roles and permissions
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `email` (text)
      - `role` (text) - 'super_admin', 'admin', 'moderator'
      - `permissions` (jsonb) - Store specific permissions
      - `is_active` (boolean)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `designer_deals` - Store exclusive deals offered by designers
      - `id` (uuid, primary key)
      - `designer_id` (uuid, references designers)
      - `title` (text) - Deal title
      - `description` (text) - Deal description
      - `discount_percentage` (numeric) - Discount percentage
      - `original_price` (numeric) - Original price
      - `deal_price` (numeric) - Deal price after discount
      - `deal_type` (text) - 'package', 'service', 'consultation', 'material'
      - `services_included` (text[]) - List of services included
      - `terms_conditions` (text) - Terms and conditions
      - `valid_from` (timestamptz) - Deal start date
      - `valid_until` (timestamptz) - Deal end date
      - `max_redemptions` (integer) - Maximum number of redemptions
      - `current_redemptions` (integer) - Current number of redemptions
      - `is_active` (boolean)
      - `is_featured` (boolean) - Featured on homepage
      - `image_url` (text) - Deal image
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `designer_projects_earnings` - Track completed projects and earnings
      - `id` (uuid, primary key)
      - `designer_id` (uuid, references designers)
      - `project_id` (uuid, references customers) - Customer project
      - `project_name` (text)
      - `project_type` (text)
      - `project_value` (numeric) - Total project value
      - `designer_earnings` (numeric) - Designer's earnings
      - `platform_commission` (numeric) - Platform commission
      - `commission_percentage` (numeric) - Commission percentage
      - `payment_status` (text) - 'pending', 'paid', 'processing'
      - `completed_at` (timestamptz) - Project completion date
      - `paid_at` (timestamptz) - Payment date
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `deal_redemptions` - Track deal redemptions by customers
      - `id` (uuid, primary key)
      - `deal_id` (uuid, references designer_deals)
      - `customer_id` (uuid, references auth.users)
      - `redeemed_at` (timestamptz)
      - `status` (text) - 'active', 'used', 'expired'

  2. Security
    - Enable RLS on all tables
    - Admin-only policies for admin_users table
    - Admin policies for managing deals
    - Public read access for active deals
    - Designer policies for their own deals
    - Admin-only access for earnings tracking

  3. Important Notes
    - Admin users are managed separately from regular authentication
    - Deals can be created and managed by admins or designers
    - Earnings tracking is automated and admin-viewable
    - Commission system is built-in for platform revenue
*/

-- Create admin_users table
CREATE TABLE IF NOT EXISTS admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  email text UNIQUE NOT NULL,
  role text NOT NULL DEFAULT 'admin' CHECK (role IN ('super_admin', 'admin', 'moderator')),
  permissions jsonb DEFAULT '{"manage_deals": true, "manage_designers": true, "view_earnings": true, "manage_users": false}'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create designer_deals table
CREATE TABLE IF NOT EXISTS designer_deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  designer_id uuid REFERENCES designers(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  discount_percentage numeric(5,2) NOT NULL CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
  original_price numeric(10,2) NOT NULL CHECK (original_price >= 0),
  deal_price numeric(10,2) NOT NULL CHECK (deal_price >= 0),
  deal_type text NOT NULL CHECK (deal_type IN ('package', 'service', 'consultation', 'material')),
  services_included text[] DEFAULT '{}',
  terms_conditions text,
  valid_from timestamptz DEFAULT now(),
  valid_until timestamptz NOT NULL,
  max_redemptions integer DEFAULT NULL,
  current_redemptions integer DEFAULT 0,
  is_active boolean DEFAULT true,
  is_featured boolean DEFAULT false,
  image_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_dates CHECK (valid_until > valid_from),
  CONSTRAINT valid_price CHECK (deal_price <= original_price)
);

-- Create designer_projects_earnings table
CREATE TABLE IF NOT EXISTS designer_projects_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  designer_id uuid REFERENCES designers(id) ON DELETE CASCADE,
  project_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  project_name text NOT NULL,
  project_type text NOT NULL,
  project_value numeric(12,2) NOT NULL CHECK (project_value >= 0),
  designer_earnings numeric(12,2) NOT NULL CHECK (designer_earnings >= 0),
  platform_commission numeric(12,2) NOT NULL CHECK (platform_commission >= 0),
  commission_percentage numeric(5,2) NOT NULL DEFAULT 15.0 CHECK (commission_percentage >= 0 AND commission_percentage <= 100),
  payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'processing', 'paid', 'cancelled')),
  completed_at timestamptz NOT NULL,
  paid_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create deal_redemptions table
CREATE TABLE IF NOT EXISTS deal_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid REFERENCES designer_deals(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  redeemed_at timestamptz DEFAULT now(),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'used', 'expired', 'cancelled')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(deal_id, customer_id)
);

-- Enable RLS
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE designer_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE designer_projects_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_redemptions ENABLE ROW LEVEL SECURITY;

-- Admin users policies
DROP POLICY IF EXISTS "Only super admins can manage admin users" ON admin_users;
CREATE POLICY "Only super admins can manage admin users"
  ON admin_users
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE user_id = auth.uid()
      AND role = 'super_admin'
      AND is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE user_id = auth.uid()
      AND role = 'super_admin'
      AND is_active = true
    )
  );

DROP POLICY IF EXISTS "Admins can read own profile" ON admin_users;
CREATE POLICY "Admins can read own profile"
  ON admin_users
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Designer deals policies
DROP POLICY IF EXISTS "Admins can manage all deals" ON designer_deals;
CREATE POLICY "Admins can manage all deals"
  ON designer_deals
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE user_id = auth.uid()
      AND is_active = true
      AND (permissions->>'manage_deals')::boolean = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE user_id = auth.uid()
      AND is_active = true
      AND (permissions->>'manage_deals')::boolean = true
    )
  );

DROP POLICY IF EXISTS "Designers can manage own deals" ON designer_deals;
CREATE POLICY "Designers can manage own deals"
  ON designer_deals
  FOR ALL
  TO authenticated
  USING (
    designer_id IN (
      SELECT id FROM designers WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    designer_id IN (
      SELECT id FROM designers WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Public can read active deals" ON designer_deals;
CREATE POLICY "Public can read active deals"
  ON designer_deals
  FOR SELECT
  TO anon, authenticated
  USING (
    is_active = true 
    AND valid_from <= now() 
    AND valid_until >= now()
  );

-- Designer earnings policies
DROP POLICY IF EXISTS "Admins can manage all earnings" ON designer_projects_earnings;
CREATE POLICY "Admins can manage all earnings"
  ON designer_projects_earnings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE user_id = auth.uid()
      AND is_active = true
      AND (permissions->>'view_earnings')::boolean = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE user_id = auth.uid()
      AND is_active = true
      AND (permissions->>'view_earnings')::boolean = true
    )
  );

DROP POLICY IF EXISTS "Designers can view own earnings" ON designer_projects_earnings;
CREATE POLICY "Designers can view own earnings"
  ON designer_projects_earnings
  FOR SELECT
  TO authenticated
  USING (
    designer_id IN (
      SELECT id FROM designers WHERE user_id = auth.uid()
    )
  );

-- Deal redemptions policies
DROP POLICY IF EXISTS "Customers can view own redemptions" ON deal_redemptions;
CREATE POLICY "Customers can view own redemptions"
  ON deal_redemptions
  FOR SELECT
  TO authenticated
  USING (customer_id = auth.uid());

DROP POLICY IF EXISTS "Customers can redeem deals" ON deal_redemptions;
CREATE POLICY "Customers can redeem deals"
  ON deal_redemptions
  FOR INSERT
  TO authenticated
  WITH CHECK (customer_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view all redemptions" ON deal_redemptions;
CREATE POLICY "Admins can view all redemptions"
  ON deal_redemptions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE user_id = auth.uid()
      AND is_active = true
    )
  );

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_admin_users_updated_at ON admin_users;
CREATE TRIGGER update_admin_users_updated_at
  BEFORE UPDATE ON admin_users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_designer_deals_updated_at ON designer_deals;
CREATE TRIGGER update_designer_deals_updated_at
  BEFORE UPDATE ON designer_deals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_designer_projects_earnings_updated_at ON designer_projects_earnings;
CREATE TRIGGER update_designer_projects_earnings_updated_at
  BEFORE UPDATE ON designer_projects_earnings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to update deal redemptions count
CREATE OR REPLACE FUNCTION update_deal_redemptions_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE designer_deals
    SET current_redemptions = current_redemptions + 1
    WHERE id = NEW.deal_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE designer_deals
    SET current_redemptions = GREATEST(0, current_redemptions - 1)
    WHERE id = OLD.deal_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_deal_redemptions_count_trigger ON deal_redemptions;
CREATE TRIGGER update_deal_redemptions_count_trigger
  AFTER INSERT OR DELETE ON deal_redemptions
  FOR EACH ROW
  EXECUTE FUNCTION update_deal_redemptions_count();

-- Function to check if admin user exists
CREATE OR REPLACE FUNCTION is_admin(user_uuid uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admin_users
    WHERE user_id = user_uuid
    AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_admin_users_user_id ON admin_users(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
CREATE INDEX IF NOT EXISTS idx_designer_deals_designer_id ON designer_deals(designer_id);
CREATE INDEX IF NOT EXISTS idx_designer_deals_active ON designer_deals(is_active, valid_from, valid_until);
CREATE INDEX IF NOT EXISTS idx_designer_deals_featured ON designer_deals(is_featured, is_active);
CREATE INDEX IF NOT EXISTS idx_designer_projects_earnings_designer_id ON designer_projects_earnings(designer_id);
CREATE INDEX IF NOT EXISTS idx_designer_projects_earnings_payment_status ON designer_projects_earnings(payment_status);
CREATE INDEX IF NOT EXISTS idx_deal_redemptions_deal_id ON deal_redemptions(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_redemptions_customer_id ON deal_redemptions(customer_id);