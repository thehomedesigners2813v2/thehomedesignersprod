/*
  # Fix designer access to assigned customer projects

  1. Policy Updates
    - Create specific policy for designers to view only assigned projects
    - Update customer update policy to allow assigned designers to edit
    - Maintain project_shares policy for email-based sharing

  2. Security
    - Remove overly broad policies
    - Ensure proper access control for assigned projects
    - Maintain customer privacy for unassigned projects
    - Use function instead of view for better RLS support
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

-- Drop the view if it exists (views don't support RLS properly)
DROP VIEW IF EXISTS designer_assigned_projects;

-- Create a function to help with fetching assigned projects
-- This replaces the problematic view approach
CREATE OR REPLACE FUNCTION get_designer_assigned_projects(designer_user_id uuid DEFAULT auth.uid())
RETURNS TABLE (
  id uuid,
  user_id uuid,
  name text,
  email text,
  phone text,
  location text,
  project_name text,
  property_type text,
  project_area text,
  budget_range text,
  timeline text,
  requirements text,
  preferred_designer text,
  layout_image_url text,
  inspiration_links text[],
  room_types text[],
  special_requirements text,
  status text,
  created_at timestamptz,
  updated_at timestamptz,
  version integer,
  assigned_designer_id uuid,
  assignment_status text,
  last_modified_by uuid,
  designer_name text,
  designer_email text,
  designer_specialization text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify the user is a designer
  IF NOT EXISTS (
    SELECT 1 FROM designers 
    WHERE user_id = designer_user_id 
    AND is_active = true
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    c.id,
    c.user_id,
    c.name,
    c.email,
    c.phone,
    c.location,
    c.project_name,
    c.property_type,
    c.project_area,
    c.budget_range,
    c.timeline,
    c.requirements,
    c.preferred_designer,
    c.layout_image_url,
    c.inspiration_links,
    c.room_types,
    c.special_requirements,
    c.status,
    c.created_at,
    c.updated_at,
    c.version,
    c.assigned_designer_id,
    c.assignment_status,
    c.last_modified_by,
    d.name as designer_name,
    d.email as designer_email,
    d.specialization as designer_specialization
  FROM customers c
  JOIN designers d ON d.id = c.assigned_designer_id
  WHERE d.user_id = designer_user_id
    AND d.is_active = true
    AND c.assigned_designer_id IS NOT NULL;
END;
$$;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION get_designer_assigned_projects(uuid) TO authenticated;

-- Add an index to improve performance for assigned project queries
CREATE INDEX IF NOT EXISTS idx_customers_assigned_designer 
ON customers (assigned_designer_id) WHERE assigned_designer_id IS NOT NULL;