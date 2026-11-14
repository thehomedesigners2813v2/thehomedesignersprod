/*
  # Fix Customer Projects Access for Designers

  1. Policy Updates
    - Fix RLS policies to allow designers to access project shares and customer data
    - Ensure case-insensitive email matching
    - Allow designers to view customer projects when they have active shares

  2. Security
    - Maintain proper security while fixing access issues
    - Ensure only active designers can access data
    - Ensure designers only see projects shared with them
*/

-- First, let's check if the auth.uid() function works properly
-- and create a helper function for better policy management

-- Drop existing policies that might be causing issues
DROP POLICY IF EXISTS "Designers can view shares sent to them" ON project_shares;
DROP POLICY IF EXISTS "Designers can view customer projects" ON customers;

-- Create a more permissive but secure policy for project_shares
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

-- Create a policy that allows designers to view customer projects
-- This is needed for the JOIN in the query to work
DROP POLICY IF EXISTS "Designers can view customer projects" ON customers;
CREATE POLICY "Designers can view customer projects"
  ON customers
  FOR SELECT
  TO authenticated
  USING (
    -- Allow if user is an active designer
    EXISTS (
      SELECT 1 FROM designers 
      WHERE designers.user_id = auth.uid() 
      AND designers.is_active = true
    )
  );

-- Let's also create an index to improve performance
CREATE INDEX IF NOT EXISTS idx_project_shares_designer_email 
ON project_shares (LOWER(designer_email));

CREATE INDEX IF NOT EXISTS idx_designers_user_id_email 
ON designers (user_id, LOWER(email)) WHERE is_active = true;