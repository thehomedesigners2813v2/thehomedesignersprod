/*
  # Create 3D Wallpapers Management System

  1. New Tables
    - `wallpapers_3d`
      - `id` (uuid, primary key)
      - `title` (text) - Name of the wallpaper design
      - `description` (text, nullable) - Description of the wallpaper
      - `image_url` (text) - URL to the wallpaper image
      - `category` (text) - Category (Geometric, Nature, Luxury, etc.)
      - `is_active` (boolean) - Whether the wallpaper is visible in gallery
      - `created_by` (uuid) - Admin user who uploaded it
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Storage
    - Create `wallpaper-images` storage bucket for wallpaper uploads
    - Public access for reading images
    - Authenticated admin access for uploads

  3. Security
    - Enable RLS on `wallpapers_3d` table
    - Allow public read access for active wallpapers
    - Allow admin insert, update, delete
    
  4. Categories
    - Predefined categories: Geometric, Nature, Luxury, Modern, Floral, Industrial, Texture, Abstract, Wood, Zen, Space, Urban
*/

-- Create wallpapers_3d table
CREATE TABLE IF NOT EXISTS wallpapers_3d (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  image_url text NOT NULL,
  category text NOT NULL,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_wallpapers_3d_category ON wallpapers_3d(category);
CREATE INDEX IF NOT EXISTS idx_wallpapers_3d_is_active ON wallpapers_3d(is_active);
CREATE INDEX IF NOT EXISTS idx_wallpapers_3d_created_at ON wallpapers_3d(created_at DESC);

-- Enable RLS
ALTER TABLE wallpapers_3d ENABLE ROW LEVEL SECURITY;

-- Public can view active wallpapers
DROP POLICY IF EXISTS "Anyone can view active wallpapers" ON wallpapers_3d;
CREATE POLICY "Anyone can view active wallpapers"
  ON wallpapers_3d FOR SELECT
  USING (is_active = true);

-- Admins can view all wallpapers
DROP POLICY IF EXISTS "Admins can view all wallpapers" ON wallpapers_3d;
CREATE POLICY "Admins can view all wallpapers"
  ON wallpapers_3d FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

-- Admins can insert wallpapers
DROP POLICY IF EXISTS "Admins can insert wallpapers" ON wallpapers_3d;
CREATE POLICY "Admins can insert wallpapers"
  ON wallpapers_3d FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

-- Admins can update wallpapers
DROP POLICY IF EXISTS "Admins can update wallpapers" ON wallpapers_3d;
CREATE POLICY "Admins can update wallpapers"
  ON wallpapers_3d FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

-- Admins can delete wallpapers
DROP POLICY IF EXISTS "Admins can delete wallpapers" ON wallpapers_3d;
CREATE POLICY "Admins can delete wallpapers"
  ON wallpapers_3d FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

-- Create storage bucket for wallpaper images
INSERT INTO storage.buckets (id, name, public)
VALUES ('wallpaper-images', 'wallpaper-images', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Public can view wallpaper images" ON storage.objects;
  DROP POLICY IF EXISTS "Admins can upload wallpaper images" ON storage.objects;
  DROP POLICY IF EXISTS "Admins can update wallpaper images" ON storage.objects;
  DROP POLICY IF EXISTS "Admins can delete wallpaper images" ON storage.objects;
END $$;

-- Storage policies for wallpaper-images bucket
CREATE POLICY "Public can view wallpaper images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'wallpaper-images');

CREATE POLICY "Admins can upload wallpaper images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'wallpaper-images' AND
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can update wallpaper images" ON storage.objects;
CREATE POLICY "Admins can update wallpaper images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'wallpaper-images' AND
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  )
  WITH CHECK (
    bucket_id = 'wallpaper-images' AND
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can delete wallpaper images" ON storage.objects;
CREATE POLICY "Admins can delete wallpaper images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'wallpaper-images' AND
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_wallpapers_3d_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_wallpapers_3d_updated_at_trigger ON wallpapers_3d;
CREATE TRIGGER update_wallpapers_3d_updated_at_trigger
  BEFORE UPDATE ON wallpapers_3d
  FOR EACH ROW
  EXECUTE FUNCTION update_wallpapers_3d_updated_at();
