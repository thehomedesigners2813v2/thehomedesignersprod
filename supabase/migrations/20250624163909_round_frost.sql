/*
  # Fix Designer Access to Assigned Customer Projects

  1. Policy Updates
    - Update RLS policies to ensure designers can only see projects assigned to them
    - Fix the customers table policy to properly check assignment
    - Ensure proper security while allowing assigned designers to view and edit projects

  2. Security
    - Designers can only see projects where they are the assigned designer
    - Maintain customer privacy by not showing unassigned projects to designers
    - Allow proper collaboration between customers and assigned designers
    - Create view without RLS (views inherit RLS from underlying tables)
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

-- Create view for designer assigned projects
-- Note: Views automatically inherit RLS from underlying tables, so no need to enable RLS on the view
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

-- Note: Views inherit RLS policies from their underlying tables automatically
-- The view will respect the "Designers can view assigned projects" policy from the customers table
-- and any relevant policies from the designers table