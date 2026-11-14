/*
  # Add Project Updates and Progress Reports

  1. New Tables
    - `project_updates` - Store project updates, photos, and progress reports
      - `id` (uuid, primary key)
      - `project_id` (uuid, references customers)
      - `designer_id` (uuid, references designers)
      - `title` (text)
      - `description` (text)
      - `update_type` (text) - 'progress_report', 'photo_update', 'milestone'
      - `photos` (text array) - URLs to photos
      - `completion_percentage` (integer)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on the table
    - Add policies for designers to manage updates for their assigned projects
    - Add policies for customers to view updates for their projects
*/

-- Create project updates table
CREATE TABLE IF NOT EXISTS project_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES customers(id) ON DELETE CASCADE,
  designer_id uuid REFERENCES designers(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  update_type text NOT NULL CHECK (update_type IN ('progress_report', 'photo_update', 'milestone')),
  photos text[] DEFAULT '{}',
  completion_percentage integer CHECK (completion_percentage BETWEEN 0 AND 100),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE project_updates ENABLE ROW LEVEL SECURITY;

-- Policies for project_updates
DROP POLICY IF EXISTS "Designers can manage updates for their assigned projects" ON project_updates;
CREATE POLICY "Designers can manage updates for their assigned projects"
  ON project_updates
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM customers
      JOIN designers ON designers.id = customers.assigned_designer_id
      WHERE customers.id = project_updates.project_id
      AND designers.user_id = auth.uid()
      AND designers.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM customers
      JOIN designers ON designers.id = customers.assigned_designer_id
      WHERE customers.id = project_updates.project_id
      AND designers.user_id = auth.uid()
      AND designers.is_active = true
    )
  );

DROP POLICY IF EXISTS "Customers can view updates for their projects" ON project_updates;
CREATE POLICY "Customers can view updates for their projects"
  ON project_updates
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.id = project_updates.project_id
      AND customers.user_id = auth.uid()
    )
  );

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_project_updates_updated_at ON project_updates;
CREATE TRIGGER update_project_updates_updated_at
  BEFORE UPDATE ON project_updates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_project_updates_project_id 
ON project_updates(project_id);

CREATE INDEX IF NOT EXISTS idx_project_updates_designer_id 
ON project_updates(designer_id);

CREATE INDEX IF NOT EXISTS idx_project_updates_created_at 
ON project_updates(created_at DESC);