/*
  # Fix Customer Quotes Visibility

  1. Issues Fixed
    - Ensure customers can properly view quotes sent to them
    - Fix RLS policies for quote items to allow customers to view them
    - Add missing policy for customers to view quote items

  2. Changes
    - Update existing policies with proper checks
    - Add new policy for customers to view quote items
    - Ensure proper access control for customers
*/

-- Ensure customers can view quotes for their projects
DO $$
BEGIN
  -- Drop policy if it exists
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'designer_quotes' 
    AND policyname = 'Customers can view quotes for their projects'
  ) THEN
    DROP POLICY "Customers can view quotes for their projects" ON designer_quotes;
  END IF;
END $$;

-- Create a more permissive policy for customers to view quotes
DROP POLICY IF EXISTS "Customers can view quotes for their projects" ON designer_quotes;
CREATE POLICY "Customers can view quotes for their projects"
  ON designer_quotes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM customers 
      WHERE customers.id = designer_quotes.project_id 
      AND customers.user_id = auth.uid()
    )
  );

-- Ensure customers can view quote items
DO $$
BEGIN
  -- Drop policy if it exists
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'quote_items' 
    AND policyname = 'Customers can view quote items for their projects'
  ) THEN
    DROP POLICY "Customers can view quote items for their projects" ON quote_items;
  END IF;
END $$;

-- Create a more permissive policy for customers to view quote items
DROP POLICY IF EXISTS "Customers can view quote items for their projects" ON quote_items;
CREATE POLICY "Customers can view quote items for their projects"
  ON quote_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM designer_quotes
      JOIN customers ON customers.id = designer_quotes.project_id
      WHERE designer_quotes.id = quote_items.quote_id
      AND customers.user_id = auth.uid()
    )
  );

-- Create a view to help customers easily access their quotes with items
CREATE OR REPLACE VIEW customer_quotes_with_items AS
SELECT 
  q.*,
  c.name as customer_name,
  c.email as customer_email,
  c.phone as customer_phone,
  c.project_name,
  d.name as designer_name,
  d.email as designer_email,
  d.phone as designer_phone,
  d.profile_image as designer_profile_image,
  d.specialization as designer_specialization,
  (
    SELECT json_agg(i.*)
    FROM quote_items i
    WHERE i.quote_id = q.id
  ) as items
FROM designer_quotes q
JOIN customers c ON c.id = q.project_id
JOIN designers d ON d.id = q.designer_id;

-- Grant access to the view
GRANT SELECT ON customer_quotes_with_items TO authenticated;