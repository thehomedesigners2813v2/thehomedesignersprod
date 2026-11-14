/*
  # Fix Quote Sending to Customers

  1. Issues Fixed
    - Fix the issue where quotes sent by designers don't appear for customers
    - Update the status field when a designer sends a quote
    - Ensure proper RLS policies for quote visibility

  2. Changes
    - Add a function to update quote status when sent
    - Create a trigger to automatically update the status
    - Fix RLS policies for better quote visibility
    - Create a comprehensive view for customer quotes with items
*/

-- Create a function to update quote status when sent
CREATE OR REPLACE FUNCTION update_quote_status_on_send()
RETURNS TRIGGER AS $$
BEGIN
  -- If status is changing from 'draft' to 'sent', update the timestamp
  IF OLD.status = 'draft' AND NEW.status = 'sent' THEN
    -- Update the timestamp to now
    NEW.updated_at := now();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to automatically update the status
DROP TRIGGER IF EXISTS update_quote_status_trigger ON designer_quotes;
CREATE TRIGGER update_quote_status_trigger
  BEFORE UPDATE ON designer_quotes
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION update_quote_status_on_send();

-- Ensure customers can view quotes for their projects
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

-- Create a comprehensive view for customer quotes with items
DROP VIEW IF EXISTS customer_quotes_with_items;
CREATE VIEW customer_quotes_with_items AS
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

-- Create a function to get customer quotes with items
DROP FUNCTION IF EXISTS get_customer_quotes(uuid);
CREATE OR REPLACE FUNCTION get_customer_quotes(customer_user_id uuid DEFAULT auth.uid())
RETURNS TABLE (
  id uuid,
  designer_id uuid,
  project_id uuid,
  quote_number text,
  title text,
  description text,
  subtotal numeric,
  discount_amount numeric,
  tax_rate numeric,
  tax_amount numeric,
  total_amount numeric,
  status text,
  valid_until date,
  terms_and_conditions text,
  notes text,
  created_at timestamptz,
  updated_at timestamptz,
  customer_accepted boolean,
  acceptance_date timestamptz,
  customer_feedback text,
  notification_sent boolean,
  customer_name text,
  customer_email text,
  customer_phone text,
  project_name text,
  designer_name text,
  designer_email text,
  designer_phone text,
  designer_profile_image text,
  designer_specialization text,
  items json
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    q.id,
    q.designer_id,
    q.project_id,
    q.quote_number,
    q.title,
    q.description,
    q.subtotal,
    q.discount_amount,
    q.tax_rate,
    q.tax_amount,
    q.total_amount,
    q.status,
    q.valid_until,
    q.terms_and_conditions,
    q.notes,
    q.created_at,
    q.updated_at,
    q.customer_accepted,
    q.acceptance_date,
    q.customer_feedback,
    q.notification_sent,
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
  JOIN designers d ON d.id = q.designer_id
  WHERE c.user_id = customer_user_id
  ORDER BY q.created_at DESC;
END;
$$;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION get_customer_quotes(uuid) TO authenticated;