/*
  # Add Admin RLS Policies

  1. Changes
    - Add RLS policies to allow admin users full access to all tables
    - Admins can view designers, customers, and other data
    - Policies check the admin_users table to verify admin status

  2. Security
    - Only active admins from admin_users table get access
    - All existing policies remain in place for regular users
*/

-- Admin policies for designers table
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'designers' 
    AND policyname = 'Admins can view all designers'
  ) THEN
    DROP POLICY IF EXISTS "Admins can view all designers" ON designers;
CREATE POLICY "Admins can view all designers"
      ON designers FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM admin_users
          WHERE admin_users.user_id = auth.uid()
          AND admin_users.is_active = true
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'designers' 
    AND policyname = 'Admins can update all designers'
  ) THEN
    DROP POLICY IF EXISTS "Admins can update all designers" ON designers;
CREATE POLICY "Admins can update all designers"
      ON designers FOR UPDATE
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
  END IF;
END $$;

-- Admin policies for customers table
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'customers' 
    AND policyname = 'Admins can view all customers'
  ) THEN
    DROP POLICY IF EXISTS "Admins can view all customers" ON customers;
CREATE POLICY "Admins can view all customers"
      ON customers FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM admin_users
          WHERE admin_users.user_id = auth.uid()
          AND admin_users.is_active = true
        )
      );
  END IF;
END $$;

-- Admin policies for designer_quotes table
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'designer_quotes' 
    AND policyname = 'Admins can view all quotes'
  ) THEN
    DROP POLICY IF EXISTS "Admins can view all quotes" ON designer_quotes;
CREATE POLICY "Admins can view all quotes"
      ON designer_quotes FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM admin_users
          WHERE admin_users.user_id = auth.uid()
          AND admin_users.is_active = true
        )
      );
  END IF;
END $$;

-- Admin policies for designer_deals table
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'designer_deals' 
    AND policyname = 'Admins can view all deals'
  ) THEN
    DROP POLICY IF EXISTS "Admins can view all deals" ON designer_deals;
CREATE POLICY "Admins can view all deals"
      ON designer_deals FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM admin_users
          WHERE admin_users.user_id = auth.uid()
          AND admin_users.is_active = true
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'designer_deals' 
    AND policyname = 'Admins can insert deals'
  ) THEN
    DROP POLICY IF EXISTS "Admins can insert deals" ON designer_deals;
CREATE POLICY "Admins can insert deals"
      ON designer_deals FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM admin_users
          WHERE admin_users.user_id = auth.uid()
          AND admin_users.is_active = true
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'designer_deals' 
    AND policyname = 'Admins can update deals'
  ) THEN
    DROP POLICY IF EXISTS "Admins can update deals" ON designer_deals;
CREATE POLICY "Admins can update deals"
      ON designer_deals FOR UPDATE
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
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'designer_deals' 
    AND policyname = 'Admins can delete deals'
  ) THEN
    DROP POLICY IF EXISTS "Admins can delete deals" ON designer_deals;
CREATE POLICY "Admins can delete deals"
      ON designer_deals FOR DELETE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM admin_users
          WHERE admin_users.user_id = auth.uid()
          AND admin_users.is_active = true
        )
      );
  END IF;
END $$;

-- Admin policy for admin_users table (admins can view other admins)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'admin_users' 
    AND policyname = 'Admins can view admin users'
  ) THEN
    DROP POLICY IF EXISTS "Admins can view admin users" ON admin_users;
CREATE POLICY "Admins can view admin users"
      ON admin_users FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM admin_users AS au
          WHERE au.user_id = auth.uid()
          AND au.is_active = true
        )
      );
  END IF;
END $$;

-- Admin policies for designer_projects_earnings table
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'designer_projects_earnings' 
    AND policyname = 'Admins can view all earnings'
  ) THEN
    DROP POLICY IF EXISTS "Admins can view all earnings" ON designer_projects_earnings;
CREATE POLICY "Admins can view all earnings"
      ON designer_projects_earnings FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM admin_users
          WHERE admin_users.user_id = auth.uid()
          AND admin_users.is_active = true
        )
      );
  END IF;
END $$;
