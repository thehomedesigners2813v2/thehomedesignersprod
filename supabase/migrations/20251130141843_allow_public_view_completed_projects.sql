/*
  # Allow Public Access to Completed Projects

  ## Overview
  This migration allows all users (with and without login) to view completed projects.
  This enables the gallery and projects pages to show all completed work from all designers.

  ## Changes
  1. Add a new RLS policy on the customers table
     - Allow SELECT for everyone (anon and authenticated)
     - Only for projects with status = 'completed'
     - This makes completed projects publicly visible

  ## Security
  - Only completed projects are visible to public
  - Pending, in-progress, and other status projects remain private
  - Personal customer information is still protected by application logic
  - Existing policies for authenticated users remain unchanged
*/

-- Add policy to allow public viewing of completed projects
DROP POLICY IF EXISTS "Anyone can view completed projects" ON customers;
CREATE POLICY "Anyone can view completed projects"
  ON customers FOR SELECT
  TO anon, authenticated
  USING (status = 'completed');
