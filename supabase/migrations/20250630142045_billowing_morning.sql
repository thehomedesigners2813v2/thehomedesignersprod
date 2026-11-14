/*
  # Add Project Team Members Table

  1. New Tables
    - `project_team_members` - Store team members for projects
      - `id` (uuid, primary key)
      - `project_id` (uuid, references customers)
      - `name` (text)
      - `role` (text)
      - `contact` (text)
      - `added_by` (uuid, references designers)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on the table
    - Add policies for designers to manage team members
    - Add policies for customers to view team members
*/

-- Create project team members table if it doesn't exist
CREATE TABLE IF NOT EXISTS project_team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES customers(id) ON DELETE CASCADE,
  name text NOT NULL,
  role text NOT NULL,
  contact text NOT NULL,
  added_by uuid REFERENCES designers(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE project_team_members ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policy 
    WHERE polname = 'Designers can manage team members for their projects' 
    AND polrelid = 'project_team_members'::regclass
  ) THEN
    DROP POLICY "Designers can manage team members for their projects" ON project_team_members;
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM pg_policy 
    WHERE polname = 'Customers can view team members for their projects' 
    AND polrelid = 'project_team_members'::regclass
  ) THEN
    DROP POLICY "Customers can view team members for their projects" ON project_team_members;
  END IF;
END $$;

-- Create new policies
DROP POLICY IF EXISTS "Designers can manage team members for their projects" ON project_team_members;
CREATE POLICY "Designers can manage team members for their projects"
  ON project_team_members
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM customers
      JOIN designers ON designers.id = customers.assigned_designer_id
      WHERE customers.id = project_team_members.project_id
      AND designers.user_id = auth.uid()
      AND customers.assignment_status IN ('finalized', 'in_progress', 'completed')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM customers
      JOIN designers ON designers.id = customers.assigned_designer_id
      WHERE customers.id = project_team_members.project_id
      AND designers.user_id = auth.uid()
      AND customers.assignment_status IN ('finalized', 'in_progress', 'completed')
    )
  );

DROP POLICY IF EXISTS "Customers can view team members for their projects" ON project_team_members;
CREATE POLICY "Customers can view team members for their projects"
  ON project_team_members
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.id = project_team_members.project_id
      AND customers.user_id = auth.uid()
    )
  );

-- Create indexes for better performance if they don't exist
CREATE INDEX IF NOT EXISTS idx_project_team_members_project_id 
ON project_team_members(project_id);

CREATE INDEX IF NOT EXISTS idx_project_team_members_added_by 
ON project_team_members(added_by);