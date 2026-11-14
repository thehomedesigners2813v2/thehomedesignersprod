/*
  # Create project_designs table for 3D design files

  1. New Tables
    - `project_designs`
      - `id` (uuid, primary key)
      - `project_id` (uuid, foreign key to customers table)
      - `designer_id` (uuid, foreign key to designers table)
      - `design_file_url` (text) - Supabase Storage URL for .sh3d file
      - `preview_image_url` (text) - Preview image URL
      - `version` (integer) - Design version number
      - `notes` (text) - Designer notes about the design
      - `customer_feedback` (text) - Customer feedback on design
      - `status` (text) - draft, submitted, approved, revision_requested
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `project_designs` table
    - Designers can create, read, update their own designs
    - Customers can view designs for their projects
    - Admins can view all designs

  3. Storage
    - Create storage bucket for design files
*/

-- Create project_designs table
CREATE TABLE IF NOT EXISTS project_designs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
  designer_id uuid REFERENCES designers(id) ON DELETE CASCADE NOT NULL,
  design_file_url text,
  preview_image_url text,
  version integer DEFAULT 1 NOT NULL,
  notes text DEFAULT '',
  customer_feedback text DEFAULT '',
  status text DEFAULT 'draft' NOT NULL CHECK (status IN ('draft', 'submitted', 'approved', 'revision_requested')),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE project_designs ENABLE ROW LEVEL SECURITY;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_project_designs_project_id ON project_designs(project_id);
CREATE INDEX IF NOT EXISTS idx_project_designs_designer_id ON project_designs(designer_id);
CREATE INDEX IF NOT EXISTS idx_project_designs_status ON project_designs(status);

-- RLS Policies for designers
DROP POLICY IF EXISTS "Designers can view their own designs" ON project_designs;
CREATE POLICY "Designers can view their own designs"
  ON project_designs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM designers
      WHERE designers.id = project_designs.designer_id
      AND designers.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Designers can create designs for their projects" ON project_designs;
CREATE POLICY "Designers can create designs for their projects"
  ON project_designs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM designers
      WHERE designers.id = project_designs.designer_id
      AND designers.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Designers can update their own designs" ON project_designs;
CREATE POLICY "Designers can update their own designs"
  ON project_designs FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM designers
      WHERE designers.id = project_designs.designer_id
      AND designers.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM designers
      WHERE designers.id = project_designs.designer_id
      AND designers.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Designers can delete their own designs" ON project_designs;
CREATE POLICY "Designers can delete their own designs"
  ON project_designs FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM designers
      WHERE designers.id = project_designs.designer_id
      AND designers.user_id = auth.uid()
    )
  );

-- RLS Policies for customers
DROP POLICY IF EXISTS "Customers can view designs for their projects" ON project_designs;
CREATE POLICY "Customers can view designs for their projects"
  ON project_designs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.id = project_designs.project_id
      AND customers.user_id = auth.uid()
      AND project_designs.status != 'draft'
    )
  );

DROP POLICY IF EXISTS "Customers can update feedback on their project designs" ON project_designs;
CREATE POLICY "Customers can update feedback on their project designs"
  ON project_designs FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.id = project_designs.project_id
      AND customers.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.id = project_designs.project_id
      AND customers.user_id = auth.uid()
    )
  );

-- RLS Policies for admins
DROP POLICY IF EXISTS "Admins can view all designs" ON project_designs;
CREATE POLICY "Admins can view all designs"
  ON project_designs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can delete any design" ON project_designs;
CREATE POLICY "Admins can delete any design"
  ON project_designs FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

-- Create storage bucket for design files
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-designs', 'project-designs', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for design files
DROP POLICY IF EXISTS "Designers can upload design files" ON storage.objects;
CREATE POLICY "Designers can upload design files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'project-designs' AND
    EXISTS (
      SELECT 1 FROM designers
      WHERE designers.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Designers can view their design files" ON storage.objects;
CREATE POLICY "Designers can view their design files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'project-designs' AND
    EXISTS (
      SELECT 1 FROM designers
      WHERE designers.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Designers can update their design files" ON storage.objects;
CREATE POLICY "Designers can update their design files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'project-designs' AND
    EXISTS (
      SELECT 1 FROM designers
      WHERE designers.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Designers can delete their design files" ON storage.objects;
CREATE POLICY "Designers can delete their design files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'project-designs' AND
    EXISTS (
      SELECT 1 FROM designers
      WHERE designers.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Customers can view design files for their projects" ON storage.objects;
CREATE POLICY "Customers can view design files for their projects"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'project-designs' AND
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can manage all design files" ON storage.objects;
CREATE POLICY "Admins can manage all design files"
  ON storage.objects FOR ALL
  TO authenticated
  USING (
    bucket_id = 'project-designs' AND
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

-- Function to auto-increment version number
CREATE OR REPLACE FUNCTION increment_design_version()
RETURNS TRIGGER AS $$
BEGIN
  -- Get the max version for this project and increment
  SELECT COALESCE(MAX(version), 0) + 1 INTO NEW.version
  FROM project_designs
  WHERE project_id = NEW.project_id AND designer_id = NEW.designer_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-increment version on insert
DROP TRIGGER IF EXISTS set_design_version ON project_designs;
CREATE TRIGGER set_design_version
  BEFORE INSERT ON project_designs
  FOR EACH ROW
  EXECUTE FUNCTION increment_design_version();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_project_designs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at
DROP TRIGGER IF EXISTS update_project_designs_timestamp ON project_designs;
CREATE TRIGGER update_project_designs_timestamp
  BEFORE UPDATE ON project_designs
  FOR EACH ROW
  EXECUTE FUNCTION update_project_designs_updated_at();