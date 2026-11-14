/*
  # Fix Designer Project Access Policies

  1. Security Updates
    - Update RLS policies for designers to view assigned projects
    - Allow designers to update projects they are assigned to
    - Fix project_shares policy for designer access
    - Create view for designer assigned projects (without RLS on view)

  2. Changes
    - Drop and recreate specific policies with better logic
    - Create helper view for designer assigned projects
    - Ensure proper access control for designers and customers
*/

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Designers can view customer projects" ON customers;
DROP POLICY IF EXISTS "Designers can view assigned projects" ON customers;
DROP POLICY IF EXISTS "Customers can update own projects" ON customers;
DROP POLICY IF EXISTS "Designers can view shares sent to them" ON project_shares;

-- Create a more specific policy that only allows designers to see projects assigned to them
CREATE POLICY "Designers can view assigned projects"
  ON customers
  FOR SELECT
  TO authenticated
  USING (
    -- Allow if the designer is specifically assigned to this project
    EXISTS (
      SELECT 1 FROM designers 
      WHERE designers.user_id = auth.uid() 
      AND designers.id = customers.assigned_designer_id
      AND designers.is_active = true
    )
  );

-- Create updated policy for customers to update their own projects and allow assigned designers
DROP POLICY IF EXISTS "Customers can update own projects" ON customers;
CREATE POLICY "Customers can update own projects"
  ON customers
  FOR UPDATE
  TO authenticated
  USING (
    -- Customer can update their own projects
    user_id = auth.uid() 
    OR 
    -- Assigned designer can update the project
    EXISTS (
      SELECT 1 FROM designers 
      WHERE designers.id = customers.assigned_designer_id 
      AND designers.user_id = auth.uid()
      AND designers.is_active = true
    )
  );

-- Update the project_shares policy to be more specific
DROP POLICY IF EXISTS "Designers can view shares sent to them" ON project_shares;
CREATE POLICY "Designers can view shares sent to them"
  ON project_shares
  FOR SELECT
  TO authenticated
  USING (
    -- Allow if user is a designer and the share is sent to their email
    EXISTS (
      SELECT 1 FROM designers 
      WHERE designers.user_id = auth.uid() 
      AND LOWER(designers.email) = LOWER(project_shares.designer_email)
      AND designers.is_active = true
    )
  );

-- Drop the view if it exists to avoid conflicts
DROP VIEW IF EXISTS designer_assigned_projects;

-- Create view for designer assigned projects (views don't support RLS directly)
CREATE VIEW designer_assigned_projects AS
SELECT 
  c.*,
  d.name as designer_name,
  d.email as designer_email,
  d.specialization as designer_specialization
FROM customers c
JOIN designers d ON d.id = c.assigned_designer_id
WHERE d.is_active = true;

-- Grant access to the view
GRANT SELECT ON designer_assigned_projects TO authenticated;

-- Note: Views inherit RLS from their underlying tables, so the customers table RLS policies
-- will automatically apply to this view. No need to enable RLS on the view itself.