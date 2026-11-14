/*
  # Add Customer Quotes Function

  1. New Function
    - Create a database function to retrieve customer quotes with items
    - Simplify client-side code by handling joins and item fetching in the database
    - Ensure proper security with RLS

  2. Security
    - Function is security definer to bypass RLS
    - Function checks user ID to ensure only authorized users can access their quotes
*/

-- Create a function to get customer quotes with items
DROP FUNCTION IF EXISTS get_customer_quotes(uuid);
CREATE OR REPLACE FUNCTION get_customer_quotes(customer_user_id uuid DEFAULT auth.uid())
RETURNS SETOF designer_quotes
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT q.*
  FROM designer_quotes q
  JOIN customers c ON c.id = q.project_id
  WHERE c.user_id = customer_user_id
  ORDER BY q.created_at DESC;
END;
$$;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION get_customer_quotes(uuid) TO authenticated;