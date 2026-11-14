/*
  # Create Project Images Gallery System

  1. New Tables
    - `project_images`
      - `id` (uuid, primary key)
      - `project_id` (uuid, foreign key to customers table)
      - `image_url` (text) - URL to the uploaded project image
      - `caption` (text, nullable) - Optional caption for the image
      - `is_primary` (boolean) - Whether this is the primary gallery image
      - `display_order` (integer) - Order in which images should be displayed
      - `uploaded_by` (uuid) - Designer who uploaded it
      - `created_at` (timestamptz)

  2. Storage
    - Create `project-gallery` storage bucket for project completion images
    - Public read access
    - Designer upload access for their assigned projects

  3. Security
    - Enable RLS on `project_images` table
    - Public can view images for completed projects
    - Designers can upload images for their assigned completed projects
    - Designers can update/delete their uploaded images

  4. Features
    - Multiple images per project
    - Primary image selection for gallery thumbnail
    - Display order for image carousel
    - Designers upload images when project status is completed
*/

-- Create project_images table
CREATE TABLE IF NOT EXISTS project_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  caption text,
  is_primary boolean DEFAULT false,
  display_order integer DEFAULT 0,
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_project_images_project_id ON project_images(project_id);
CREATE INDEX IF NOT EXISTS idx_project_images_is_primary ON project_images(is_primary);
CREATE INDEX IF NOT EXISTS idx_project_images_display_order ON project_images(display_order);
CREATE INDEX IF NOT EXISTS idx_project_images_created_at ON project_images(created_at DESC);

-- Enable RLS
ALTER TABLE project_images ENABLE ROW LEVEL SECURITY;

-- Public can view images for completed projects only
DROP POLICY IF EXISTS "Anyone can view images for completed projects" ON project_images;
CREATE POLICY "Anyone can view images for completed projects"
  ON project_images FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.id = project_images.project_id
      AND customers.assignment_status = 'completed'
    )
  );

-- Designers can view all images for their assigned projects
DROP POLICY IF EXISTS "Designers can view images for assigned projects" ON project_images;
CREATE POLICY "Designers can view images for assigned projects"
  ON project_images FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM customers
      JOIN designers ON designers.id = customers.assigned_designer_id
      WHERE customers.id = project_images.project_id
      AND designers.user_id = auth.uid()
    )
  );

-- Designers can upload images for their assigned completed projects
DROP POLICY IF EXISTS "Designers can upload images for assigned completed projects" ON project_images;
CREATE POLICY "Designers can upload images for assigned completed projects"
  ON project_images FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM customers
      JOIN designers ON designers.id = customers.assigned_designer_id
      WHERE customers.id = project_images.project_id
      AND designers.user_id = auth.uid()
      AND customers.assignment_status = 'completed'
    )
  );

-- Designers can update their uploaded images
DROP POLICY IF EXISTS "Designers can update their uploaded images" ON project_images;
CREATE POLICY "Designers can update their uploaded images"
  ON project_images FOR UPDATE
  TO authenticated
  USING (uploaded_by = auth.uid())
  WITH CHECK (uploaded_by = auth.uid());

-- Designers can delete their uploaded images
DROP POLICY IF EXISTS "Designers can delete their uploaded images" ON project_images;
CREATE POLICY "Designers can delete their uploaded images"
  ON project_images FOR DELETE
  TO authenticated
  USING (uploaded_by = auth.uid());

-- Create storage bucket for project gallery images
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-gallery', 'project-gallery', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for project-gallery bucket
DROP POLICY IF EXISTS "Public can view project gallery images" ON storage.objects;
CREATE POLICY "Public can view project gallery images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'project-gallery');

DROP POLICY IF EXISTS "Designers can upload project gallery images" ON storage.objects;
CREATE POLICY "Designers can upload project gallery images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'project-gallery' AND
    EXISTS (
      SELECT 1 FROM designers
      WHERE designers.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Designers can update project gallery images" ON storage.objects;
CREATE POLICY "Designers can update project gallery images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'project-gallery' AND
    EXISTS (
      SELECT 1 FROM designers
      WHERE designers.user_id = auth.uid()
    )
  )
  WITH CHECK (
    bucket_id = 'project-gallery' AND
    EXISTS (
      SELECT 1 FROM designers
      WHERE designers.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Designers can delete project gallery images" ON storage.objects;
CREATE POLICY "Designers can delete project gallery images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'project-gallery' AND
    EXISTS (
      SELECT 1 FROM designers
      WHERE designers.user_id = auth.uid()
    )
  );

-- Function to ensure only one primary image per project
CREATE OR REPLACE FUNCTION ensure_single_primary_image()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_primary = true THEN
    UPDATE project_images
    SET is_primary = false
    WHERE project_id = NEW.project_id
    AND id != NEW.id
    AND is_primary = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to maintain single primary image
DROP TRIGGER IF EXISTS ensure_single_primary_image_trigger ON project_images;
CREATE TRIGGER ensure_single_primary_image_trigger
  BEFORE INSERT OR UPDATE ON project_images
  FOR EACH ROW
  WHEN (NEW.is_primary = true)
  EXECUTE FUNCTION ensure_single_primary_image();
