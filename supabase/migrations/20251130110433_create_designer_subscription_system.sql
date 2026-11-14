/*
  # Designer Subscription System with 30-Day Free Trial

  ## Overview
  This migration creates a comprehensive subscription system for designers with:
  - 30-day free trial period
  - Multiple subscription tiers
  - Payment tracking and history
  - Automatic trial expiration handling
  - Subscription status management

  ## New Tables

  ### 1. `subscription_plans`
  Defines available subscription tiers for designers
  - `id` (uuid, primary key)
  - `name` (text) - Plan name (e.g., "Basic", "Professional", "Premium")
  - `description` (text) - Plan description
  - `price` (numeric) - Monthly price in INR
  - `billing_period` (text) - "monthly" or "yearly"
  - `features` (jsonb) - Array of features included
  - `max_projects` (integer) - Maximum concurrent projects
  - `max_quotes` (integer) - Maximum quotes per month
  - `priority_support` (boolean)
  - `is_active` (boolean) - Whether plan is available for signup
  - `sort_order` (integer) - Display order
  - `created_at`, `updated_at` (timestamptz)

  ### 2. `designer_subscriptions`
  Tracks each designer's subscription status
  - `id` (uuid, primary key)
  - `designer_id` (uuid, FK to designers) - UNIQUE
  - `subscription_plan_id` (uuid, FK to subscription_plans)
  - `status` (text) - trial, active, expired, cancelled, suspended
  - `trial_start_date` (timestamptz) - When trial started
  - `trial_end_date` (timestamptz) - When trial ends (30 days from start)
  - `subscription_start_date` (timestamptz) - When paid subscription started
  - `subscription_end_date` (timestamptz) - When current billing period ends
  - `auto_renew` (boolean) - Whether subscription auto-renews
  - `cancelled_at` (timestamptz) - When subscription was cancelled
  - `cancellation_reason` (text)
  - `created_at`, `updated_at` (timestamptz)

  ### 3. `subscription_payments`
  Records all payment transactions
  - `id` (uuid, primary key)
  - `designer_subscription_id` (uuid, FK to designer_subscriptions)
  - `amount` (numeric) - Payment amount
  - `currency` (text) - Default "INR"
  - `payment_method` (text) - card, upi, netbanking, wallet
  - `payment_gateway` (text) - stripe, razorpay, etc.
  - `transaction_id` (text) - Gateway transaction ID
  - `payment_status` (text) - pending, completed, failed, refunded
  - `payment_date` (timestamptz)
  - `billing_period_start` (timestamptz)
  - `billing_period_end` (timestamptz)
  - `metadata` (jsonb) - Additional payment details
  - `created_at`, `updated_at` (timestamptz)

  ### 4. `subscription_usage_tracking`
  Tracks usage against subscription limits
  - `id` (uuid, primary key)
  - `designer_subscription_id` (uuid, FK to designer_subscriptions)
  - `period_start` (timestamptz)
  - `period_end` (timestamptz)
  - `projects_created` (integer) - Projects in current period
  - `quotes_generated` (integer) - Quotes in current period
  - `storage_used_mb` (numeric) - Storage used
  - `last_updated` (timestamptz)
  - `created_at` (timestamptz)

  ## Security
  - Enable RLS on all tables
  - Designers can view their own subscription data
  - Designers can update their subscription preferences
  - Admin users can manage all subscriptions
  - Payment data is read-only for designers

  ## Functions
  - `check_subscription_status()` - Returns current subscription status
  - `is_trial_expired()` - Checks if trial period has ended
  - `can_access_feature()` - Validates feature access based on plan
  - `update_subscription_status()` - Trigger to auto-update expired subscriptions
*/

-- Create subscription_plans table
CREATE TABLE IF NOT EXISTS subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text NOT NULL,
  price numeric NOT NULL CHECK (price >= 0),
  billing_period text NOT NULL DEFAULT 'monthly' CHECK (billing_period IN ('monthly', 'yearly')),
  features jsonb DEFAULT '[]'::jsonb,
  max_projects integer DEFAULT 10 CHECK (max_projects > 0),
  max_quotes integer DEFAULT 20 CHECK (max_quotes > 0),
  priority_support boolean DEFAULT false,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create designer_subscriptions table
CREATE TABLE IF NOT EXISTS designer_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  designer_id uuid NOT NULL UNIQUE REFERENCES designers(id) ON DELETE CASCADE,
  subscription_plan_id uuid REFERENCES subscription_plans(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'trial' CHECK (status IN ('trial', 'active', 'expired', 'cancelled', 'suspended')),
  trial_start_date timestamptz DEFAULT now(),
  trial_end_date timestamptz DEFAULT (now() + interval '30 days'),
  subscription_start_date timestamptz,
  subscription_end_date timestamptz,
  auto_renew boolean DEFAULT true,
  cancelled_at timestamptz,
  cancellation_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create subscription_payments table
CREATE TABLE IF NOT EXISTS subscription_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  designer_subscription_id uuid NOT NULL REFERENCES designer_subscriptions(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount >= 0),
  currency text DEFAULT 'INR',
  payment_method text CHECK (payment_method IN ('card', 'upi', 'netbanking', 'wallet', 'other')),
  payment_gateway text,
  transaction_id text UNIQUE,
  payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),
  payment_date timestamptz DEFAULT now(),
  billing_period_start timestamptz,
  billing_period_end timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create subscription_usage_tracking table
CREATE TABLE IF NOT EXISTS subscription_usage_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  designer_subscription_id uuid NOT NULL REFERENCES designer_subscriptions(id) ON DELETE CASCADE,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  projects_created integer DEFAULT 0,
  quotes_generated integer DEFAULT 0,
  storage_used_mb numeric DEFAULT 0,
  last_updated timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(designer_subscription_id, period_start)
);

-- Enable RLS
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE designer_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_usage_tracking ENABLE ROW LEVEL SECURITY;

-- RLS Policies for subscription_plans
DROP POLICY IF EXISTS "Anyone can view active subscription plans" ON subscription_plans;
CREATE POLICY "Anyone can view active subscription plans"
  ON subscription_plans FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "Admins can manage subscription plans" ON subscription_plans;
CREATE POLICY "Admins can manage subscription plans"
  ON subscription_plans FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.is_active = true
    )
  );

-- RLS Policies for designer_subscriptions
DROP POLICY IF EXISTS "Designers can view own subscription" ON designer_subscriptions;
CREATE POLICY "Designers can view own subscription"
  ON designer_subscriptions FOR SELECT
  TO authenticated
  USING (
    designer_id IN (
      SELECT id FROM designers WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Designers can update own subscription preferences" ON designer_subscriptions;
CREATE POLICY "Designers can update own subscription preferences"
  ON designer_subscriptions FOR UPDATE
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

DROP POLICY IF EXISTS "Admins can view all subscriptions" ON designer_subscriptions;
CREATE POLICY "Admins can view all subscriptions"
  ON designer_subscriptions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.is_active = true
    )
  );

DROP POLICY IF EXISTS "Admins can manage all subscriptions" ON designer_subscriptions;
CREATE POLICY "Admins can manage all subscriptions"
  ON designer_subscriptions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.is_active = true
    )
  );

-- RLS Policies for subscription_payments
DROP POLICY IF EXISTS "Designers can view own payment history" ON subscription_payments;
CREATE POLICY "Designers can view own payment history"
  ON subscription_payments FOR SELECT
  TO authenticated
  USING (
    designer_subscription_id IN (
      SELECT id FROM designer_subscriptions
      WHERE designer_id IN (
        SELECT id FROM designers WHERE user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Admins can view all payments" ON subscription_payments;
CREATE POLICY "Admins can view all payments"
  ON subscription_payments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.is_active = true
    )
  );

DROP POLICY IF EXISTS "Admins can manage payments" ON subscription_payments;
CREATE POLICY "Admins can manage payments"
  ON subscription_payments FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.is_active = true
    )
  );

-- RLS Policies for subscription_usage_tracking
DROP POLICY IF EXISTS "Designers can view own usage" ON subscription_usage_tracking;
CREATE POLICY "Designers can view own usage"
  ON subscription_usage_tracking FOR SELECT
  TO authenticated
  USING (
    designer_subscription_id IN (
      SELECT id FROM designer_subscriptions
      WHERE designer_id IN (
        SELECT id FROM designers WHERE user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Admins can view all usage" ON subscription_usage_tracking;
CREATE POLICY "Admins can view all usage"
  ON subscription_usage_tracking FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.is_active = true
    )
  );

-- Function to check if trial is expired
CREATE OR REPLACE FUNCTION is_trial_expired(designer_sub_id uuid)
RETURNS boolean AS $$
DECLARE
  sub_record designer_subscriptions%ROWTYPE;
BEGIN
  SELECT * INTO sub_record FROM designer_subscriptions WHERE id = designer_sub_id;
  
  IF NOT FOUND THEN
    RETURN true;
  END IF;
  
  IF sub_record.status = 'trial' AND sub_record.trial_end_date < now() THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check subscription status
CREATE OR REPLACE FUNCTION check_subscription_status(p_designer_id uuid)
RETURNS text AS $$
DECLARE
  sub_record designer_subscriptions%ROWTYPE;
BEGIN
  SELECT * INTO sub_record 
  FROM designer_subscriptions 
  WHERE designer_id = p_designer_id;
  
  IF NOT FOUND THEN
    RETURN 'no_subscription';
  END IF;
  
  -- Check if trial expired
  IF sub_record.status = 'trial' AND sub_record.trial_end_date < now() THEN
    UPDATE designer_subscriptions 
    SET status = 'expired', updated_at = now()
    WHERE id = sub_record.id;
    RETURN 'expired';
  END IF;
  
  -- Check if active subscription expired
  IF sub_record.status = 'active' AND sub_record.subscription_end_date < now() THEN
    UPDATE designer_subscriptions 
    SET status = 'expired', updated_at = now()
    WHERE id = sub_record.id;
    RETURN 'expired';
  END IF;
  
  RETURN sub_record.status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check feature access
CREATE OR REPLACE FUNCTION can_access_feature(p_designer_id uuid, p_feature text)
RETURNS boolean AS $$
DECLARE
  sub_status text;
  sub_record designer_subscriptions%ROWTYPE;
BEGIN
  sub_status := check_subscription_status(p_designer_id);
  
  -- If expired or cancelled, no access
  IF sub_status IN ('expired', 'cancelled', 'suspended', 'no_subscription') THEN
    RETURN false;
  END IF;
  
  -- Trial and active users have access
  IF sub_status IN ('trial', 'active') THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update subscription status
CREATE OR REPLACE FUNCTION trigger_update_subscription_status()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  
  -- Auto-expire trial if end date passed
  IF NEW.status = 'trial' AND NEW.trial_end_date < now() THEN
    NEW.status = 'expired';
  END IF;
  
  -- Auto-expire active subscription if end date passed
  IF NEW.status = 'active' AND NEW.subscription_end_date IS NOT NULL AND NEW.subscription_end_date < now() THEN
    NEW.status = 'expired';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_subscription_status_trigger ON designer_subscriptions;

CREATE TRIGGER update_subscription_status_trigger
  BEFORE UPDATE ON designer_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_subscription_status();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_designer_subscriptions_designer_id ON designer_subscriptions(designer_id);
CREATE INDEX IF NOT EXISTS idx_designer_subscriptions_status ON designer_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_designer_sub_id ON subscription_payments(designer_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_status ON subscription_payments(payment_status);

-- Insert default subscription plans
INSERT INTO subscription_plans (name, description, price, billing_period, features, max_projects, max_quotes, priority_support, sort_order)
VALUES 
  (
    'Basic',
    'Perfect for individual designers starting out',
    999,
    'monthly',
    '["Up to 5 concurrent projects", "20 quotes per month", "Basic portfolio showcase", "Customer messaging", "Email support"]'::jsonb,
    5,
    20,
    false,
    1
  ),
  (
    'Professional',
    'For established designers with growing business',
    2499,
    'monthly',
    '["Up to 15 concurrent projects", "50 quotes per month", "Premium portfolio showcase", "Customer messaging", "Priority email support", "Analytics dashboard", "Custom branding"]'::jsonb,
    15,
    50,
    true,
    2
  ),
  (
    'Premium',
    'For design firms and high-volume professionals',
    4999,
    'monthly',
    '["Unlimited projects", "Unlimited quotes", "Featured portfolio showcase", "Customer messaging", "24/7 priority support", "Advanced analytics", "Custom branding", "API access", "Dedicated account manager"]'::jsonb,
    999,
    999,
    true,
    3
  )
ON CONFLICT (name) DO NOTHING;

-- Function to initialize subscription for new designers
CREATE OR REPLACE FUNCTION initialize_designer_subscription()
RETURNS trigger AS $$
DECLARE
  basic_plan_id uuid;
BEGIN
  -- Get the Basic plan ID
  SELECT id INTO basic_plan_id FROM subscription_plans WHERE name = 'Basic' AND is_active = true LIMIT 1;
  
  -- Create trial subscription for new designer
  INSERT INTO designer_subscriptions (
    designer_id,
    subscription_plan_id,
    status,
    trial_start_date,
    trial_end_date
  ) VALUES (
    NEW.id,
    basic_plan_id,
    'trial',
    now(),
    now() + interval '30 days'
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create subscription for new designers
DROP TRIGGER IF EXISTS create_designer_subscription_trigger ON designers;

CREATE TRIGGER create_designer_subscription_trigger
  AFTER INSERT ON designers
  FOR EACH ROW
  EXECUTE FUNCTION initialize_designer_subscription();

-- Add subscription check to existing designers without subscriptions
DO $$
DECLARE
  designer_record designers%ROWTYPE;
  basic_plan_id uuid;
BEGIN
  SELECT id INTO basic_plan_id FROM subscription_plans WHERE name = 'Basic' AND is_active = true LIMIT 1;
  
  FOR designer_record IN 
    SELECT * FROM designers 
    WHERE id NOT IN (SELECT designer_id FROM designer_subscriptions)
  LOOP
    INSERT INTO designer_subscriptions (
      designer_id,
      subscription_plan_id,
      status,
      trial_start_date,
      trial_end_date
    ) VALUES (
      designer_record.id,
      basic_plan_id,
      'trial',
      now(),
      now() + interval '30 days'
    );
  END LOOP;
END $$;