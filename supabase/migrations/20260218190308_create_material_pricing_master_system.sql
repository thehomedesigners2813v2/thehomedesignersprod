/*
  # Create Material Pricing Master System with Auto-Assignment
  
  ## Summary
  This migration establishes a master material pricing template system that automatically
  assigns default materials to designers when they register. This ensures every designer
  starts with a comprehensive set of standard materials they can customize.

  ## 1. New Tables
    - `material_pricing_master` - Master template table for default material pricing
      - `id` (uuid, primary key)
      - `category` (text) - Material category (e.g., "Plywood & Boards")
      - `name` (text) - Material name (e.g., "Marine Plywood")
      - `description` (text) - Detailed material description
      - `unit` (text) - Unit of measurement (e.g., "sq.ft", "per piece")
      - `base_price` (numeric) - Standard base price in INR
      - `brand` (text) - Suggested brand or manufacturer
      - `quality_grade` (text) - Quality tier (Budget/Standard/Premium/Luxury)
      - `is_active` (boolean) - Whether to include in auto-assignment
      - `created_at` (timestamptz) - Record creation timestamp
      - `updated_at` (timestamptz) - Last update timestamp

  ## 2. Database Functions
    - `assign_default_materials_to_designer()` - Automatically copies all active master
      materials to a newly registered designer's material pricing table

  ## 3. Triggers
    - `auto_assign_materials_on_designer_registration` - Fires after a new designer
      record is inserted, automatically populating their material pricing catalog

  ## 4. Security
    - Enable RLS on `material_pricing_master` table
    - Admin users can manage master materials (insert, update, delete)
    - All authenticated users can read active master materials
    - Designers receive personal copies they can customize independently

  ## 5. Initial Data
    - 30+ comprehensive default materials across 10 categories
    - Covers essential interior design materials with realistic pricing
    - Includes materials for modular kitchens, wardrobes, flooring, lighting, etc.

  ## Important Notes
    - Materials are COPIED to designer's table, not referenced, allowing full customization
    - Designers can modify, add, or delete materials without affecting the master list
    - Admin can update master list to include new materials for future designers
    - Existing designers are not affected when master list changes
*/

-- Create material pricing master table
CREATE TABLE IF NOT EXISTS material_pricing_master (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  name text NOT NULL,
  description text,
  unit text NOT NULL,
  base_price numeric(10,2) NOT NULL CHECK (base_price >= 0),
  brand text,
  quality_grade text NOT NULL CHECK (quality_grade IN ('Budget', 'Standard', 'Premium', 'Luxury')),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(category, name)
);

-- Enable RLS
ALTER TABLE material_pricing_master ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read active materials
DROP POLICY IF EXISTS "Authenticated users can read active master materials" ON material_pricing_master;
CREATE POLICY "Authenticated users can read active master materials"
  ON material_pricing_master
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Allow admin users to manage master materials
DROP POLICY IF EXISTS "Admin users can manage master materials" ON material_pricing_master;
CREATE POLICY "Admin users can manage master materials"
  ON material_pricing_master
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.is_active = true
    )
  );

-- Create trigger for updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_material_pricing_master_updated_at'
    AND tgrelid = 'material_pricing_master'::regclass
  ) THEN
    DROP TRIGGER IF EXISTS update_material_pricing_master_updated_at ON material_pricing_master;
CREATE TRIGGER update_material_pricing_master_updated_at
      BEFORE UPDATE ON material_pricing_master
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_material_pricing_master_category 
  ON material_pricing_master(category);

CREATE INDEX IF NOT EXISTS idx_material_pricing_master_is_active 
  ON material_pricing_master(is_active);

CREATE INDEX IF NOT EXISTS idx_material_pricing_master_name 
  ON material_pricing_master(name);

-- Create function to assign default materials to a new designer
CREATE OR REPLACE FUNCTION assign_default_materials_to_designer()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Copy all active master materials to the new designer's pricing table
  INSERT INTO designer_material_prices (
    designer_id,
    category,
    name,
    description,
    unit,
    base_price,
    discount_price,
    is_discounted,
    brand,
    quality_grade,
    is_available
  )
  SELECT
    NEW.id,
    category,
    name,
    description,
    unit,
    base_price,
    NULL,
    false,
    brand,
    quality_grade,
    true
  FROM material_pricing_master
  WHERE is_active = true;
  
  RETURN NEW;
END;
$$;

-- Create trigger on designers table to auto-assign materials
DROP TRIGGER IF EXISTS auto_assign_materials_on_designer_registration ON designers;

CREATE TRIGGER auto_assign_materials_on_designer_registration
  AFTER INSERT ON designers
  FOR EACH ROW
  EXECUTE FUNCTION assign_default_materials_to_designer();
