/*
  # Create project tracking and activity log system

  1. New Tables
    - `project_activities` - Log all changes made to projects
    - `project_assignments` - Track designer assignments to projects
    - `project_versions` - Store project version history

  2. Updates to existing tables
    - Add version tracking to customers table
    - Add assignment status and designer fields

  3. Security
    - Enable RLS on all new tables
    - Add policies for customers and designers
*/

-- Add version tracking and assignment fields to customers table
ALTER TABLE customers ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS assigned_designer_id UUID REFERENCES designers(id);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS assignment_status TEXT DEFAULT 'unassigned';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_modified_by UUID REFERENCES auth.users(id);

-- Create project activities table for logging all changes
CREATE TABLE IF NOT EXISTS project_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  user_type TEXT NOT NULL, -- 'customer' or 'designer'
  user_name TEXT NOT NULL,
  activity_type TEXT NOT NULL, -- 'created', 'updated', 'assigned', 'status_changed', 'submitted'
  description TEXT NOT NULL,
  changes JSONB, -- Store what fields were changed
  old_values JSONB, -- Store previous values
  new_values JSONB, -- Store new values
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create project assignments table
CREATE TABLE IF NOT EXISTS project_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  designer_id UUID REFERENCES designers(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending', -- 'pending', 'accepted', 'rejected', 'completed'
  assigned_at TIMESTAMPTZ DEFAULT now(),
  responded_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create project versions table for version history
CREATE TABLE IF NOT EXISTS project_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  data JSONB NOT NULL, -- Store complete project data at this version
  created_by UUID REFERENCES auth.users(id),
  created_by_type TEXT NOT NULL, -- 'customer' or 'designer'
  created_by_name TEXT NOT NULL,
  change_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE project_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_versions ENABLE ROW LEVEL SECURITY;

-- Policies for project_activities
DROP POLICY IF EXISTS "Users can view activities for their projects" ON project_activities;
CREATE POLICY "Users can view activities for their projects"
  ON project_activities
  FOR SELECT
  TO authenticated
  USING (
    -- Customer can see activities for their projects
    EXISTS (
      SELECT 1 FROM customers 
      WHERE customers.id = project_activities.project_id 
      AND customers.user_id = auth.uid()
    )
    OR
    -- Designer can see activities for assigned projects
    EXISTS (
      SELECT 1 FROM customers 
      JOIN designers ON designers.id = customers.assigned_designer_id
      WHERE customers.id = project_activities.project_id 
      AND designers.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "System can insert activities" ON project_activities;
CREATE POLICY "System can insert activities"
  ON project_activities
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policies for project_assignments
DROP POLICY IF EXISTS "Users can view their assignments" ON project_assignments;
CREATE POLICY "Users can view their assignments"
  ON project_assignments
  FOR SELECT
  TO authenticated
  USING (
    customer_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM designers 
      WHERE designers.id = project_assignments.designer_id 
      AND designers.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Customers can create assignments" ON project_assignments;
CREATE POLICY "Customers can create assignments"
  ON project_assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (customer_id = auth.uid());

DROP POLICY IF EXISTS "Designers can update assignments" ON project_assignments;
CREATE POLICY "Designers can update assignments"
  ON project_assignments
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM designers 
      WHERE designers.id = project_assignments.designer_id 
      AND designers.user_id = auth.uid()
    )
  );

-- Policies for project_versions
DROP POLICY IF EXISTS "Users can view versions for their projects" ON project_versions;
CREATE POLICY "Users can view versions for their projects"
  ON project_versions
  FOR SELECT
  TO authenticated
  USING (
    -- Customer can see versions for their projects
    EXISTS (
      SELECT 1 FROM customers 
      WHERE customers.id = project_versions.project_id 
      AND customers.user_id = auth.uid()
    )
    OR
    -- Designer can see versions for assigned projects
    EXISTS (
      SELECT 1 FROM customers 
      JOIN designers ON designers.id = customers.assigned_designer_id
      WHERE customers.id = project_versions.project_id 
      AND designers.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "System can insert versions" ON project_versions;
CREATE POLICY "System can insert versions"
  ON project_versions
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Update existing policies for customers table to allow designers to edit assigned projects
DROP POLICY IF EXISTS "Customers can update own projects" ON customers;

CREATE POLICY "Customers can update own projects"
  ON customers
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM designers 
      WHERE designers.id = customers.assigned_designer_id 
      AND designers.user_id = auth.uid()
    )
  );

-- Add triggers for automatic activity logging and version creation
CREATE OR REPLACE FUNCTION log_project_activity()
RETURNS TRIGGER AS $$
DECLARE
  user_type_val TEXT;
  user_name_val TEXT;
  activity_desc TEXT;
  changes_json JSONB := '{}';
  old_vals JSONB := '{}';
  new_vals JSONB := '{}';
BEGIN
  -- Determine user type and name
  IF EXISTS (SELECT 1 FROM designers WHERE user_id = auth.uid()) THEN
    user_type_val := 'designer';
    SELECT name INTO user_name_val FROM designers WHERE user_id = auth.uid();
  ELSE
    user_type_val := 'customer';
    SELECT COALESCE(name, email) INTO user_name_val FROM customers WHERE user_id = auth.uid() LIMIT 1;
    IF user_name_val IS NULL THEN
      SELECT COALESCE(raw_user_meta_data->>'name', email) INTO user_name_val FROM auth.users WHERE id = auth.uid();
    END IF;
  END IF;

  IF TG_OP = 'INSERT' THEN
    activity_desc := 'Project created';
    new_vals := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    activity_desc := 'Project updated';
    old_vals := to_jsonb(OLD);
    new_vals := to_jsonb(NEW);
    
    -- Track specific changes
    IF OLD.assigned_designer_id IS DISTINCT FROM NEW.assigned_designer_id THEN
      activity_desc := 'Designer assigned to project';
    ELSIF OLD.assignment_status IS DISTINCT FROM NEW.assignment_status THEN
      activity_desc := 'Project status changed';
    END IF;
  END IF;

  -- Insert activity log
  INSERT INTO project_activities (
    project_id, user_id, user_type, user_name, activity_type, description, 
    changes, old_values, new_values
  ) VALUES (
    COALESCE(NEW.id, OLD.id), auth.uid(), user_type_val, user_name_val, 
    TG_OP, activity_desc, changes_json, old_vals, new_vals
  );

  -- Create version snapshot for updates
  IF TG_OP = 'UPDATE' THEN
    INSERT INTO project_versions (
      project_id, version, data, created_by, created_by_type, created_by_name, change_summary
    ) VALUES (
      NEW.id, NEW.version, to_jsonb(NEW), auth.uid(), user_type_val, user_name_val, activity_desc
    );
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO project_versions (
      project_id, version, data, created_by, created_by_type, created_by_name, change_summary
    ) VALUES (
      NEW.id, NEW.version, to_jsonb(NEW), auth.uid(), user_type_val, user_name_val, 'Initial version'
    );
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers
DROP TRIGGER IF EXISTS project_activity_trigger ON customers;
CREATE TRIGGER project_activity_trigger
  AFTER INSERT OR UPDATE ON customers
  FOR EACH ROW
  EXECUTE FUNCTION log_project_activity();

-- Add trigger for assignment updates
DROP TRIGGER IF EXISTS update_project_assignments_updated_at ON project_assignments;
CREATE TRIGGER update_project_assignments_updated_at
  BEFORE UPDATE ON project_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_project_activities_project_id ON project_activities(project_id);
CREATE INDEX IF NOT EXISTS idx_project_activities_created_at ON project_activities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_assignments_project_id ON project_assignments(project_id);
CREATE INDEX IF NOT EXISTS idx_project_assignments_designer_id ON project_assignments(designer_id);
CREATE INDEX IF NOT EXISTS idx_project_versions_project_id ON project_versions(project_id);
CREATE INDEX IF NOT EXISTS idx_customers_assigned_designer ON customers(assigned_designer_id);