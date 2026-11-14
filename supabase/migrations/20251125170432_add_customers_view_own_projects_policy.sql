/*
  # Add Missing Customer SELECT Policy

  1. Problem
    - Customers cannot view their own projects because there's no SELECT policy
    - Only admins and designers have SELECT policies on the customers table
    - The MyProjects page queries by user_id but RLS blocks the query

  2. Solution
    - Add a SELECT policy allowing customers to view their own projects
    - Policy checks that the user_id matches the authenticated user

  3. Security
    - Policy ensures customers can only see their own projects
    - Uses (select auth.uid()) for better performance
*/

-- Add policy for customers to view their own projects
DROP POLICY IF EXISTS "Customers can view own projects" ON customers;
CREATE POLICY "Customers can view own projects"
  ON customers FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));
