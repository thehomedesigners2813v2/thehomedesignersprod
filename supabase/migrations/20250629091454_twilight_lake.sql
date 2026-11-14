/*
  # Add Designer Material Pricing System

  1. New Tables
    - `designer_material_prices` - Store material pricing information for designers

  2. Security
    - Enable RLS on the table
    - Add policies for designers to manage their own material prices
    - Add policies for customers to view material prices
*/

-- Create designer material prices table
CREATE TABLE IF NOT EXISTS designer_material_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  designer_id uuid REFERENCES designers(id) ON DELETE CASCADE,
  category text NOT NULL,
  name text NOT NULL,
  description text,
  unit text NOT NULL,
  base_price numeric(10,2) NOT NULL,
  discount_price numeric(10,2),
  is_discounted boolean DEFAULT false,
  brand text,
  quality_grade text NOT NULL,
  is_available boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE designer_material_prices ENABLE ROW LEVEL SECURITY;

-- Policies for designer_material_prices
DROP POLICY IF EXISTS "Designers can manage their own material prices" ON designer_material_prices;
CREATE POLICY "Designers can manage their own material prices"
  ON designer_material_prices
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM designers 
      WHERE designers.id = designer_material_prices.designer_id 
      AND designers.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM designers 
      WHERE designers.id = designer_material_prices.designer_id 
      AND designers.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Public can read available material prices" ON designer_material_prices;
CREATE POLICY "Public can read available material prices"
  ON designer_material_prices
  FOR SELECT
  TO anon, authenticated
  USING (
    is_available = true AND
    EXISTS (
      SELECT 1 FROM designers 
      WHERE designers.id = designer_material_prices.designer_id 
      AND designers.is_active = true
    )
  );

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_designer_material_prices_updated_at ON designer_material_prices;
CREATE TRIGGER update_designer_material_prices_updated_at
  BEFORE UPDATE ON designer_material_prices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_designer_material_prices_designer_id 
ON designer_material_prices(designer_id);

CREATE INDEX IF NOT EXISTS idx_designer_material_prices_category 
ON designer_material_prices(category);

CREATE INDEX IF NOT EXISTS idx_designer_material_prices_name 
ON designer_material_prices(name);

-- Insert sample data
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
  id as designer_id,
  'Plywood & Boards' as category,
  'Marine Plywood' as name,
  'High-quality waterproof plywood made with phenolic resin, ideal for moisture-prone areas.' as description,
  'sq.ft' as unit,
  120 as base_price,
  100 as discount_price,
  true as is_discounted,
  'Century Ply' as brand,
  'Premium' as quality_grade,
  true as is_available
FROM designers
WHERE email = 'priya.sharma@interiorcraft.com'
LIMIT 1;

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
  id as designer_id,
  'Laminates & Veneers' as category,
  'High Pressure Laminate (HPL)' as name,
  'Durable decorative surface material made from multiple layers of kraft paper and resin.' as description,
  'sq.ft' as unit,
  85 as base_price,
  null as discount_price,
  false as is_discounted,
  'Merino' as brand,
  'Standard' as quality_grade,
  true as is_available
FROM designers
WHERE email = 'priya.sharma@interiorcraft.com'
LIMIT 1;

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
  id as designer_id,
  'Hardware' as category,
  'Soft Close Hinges' as name,
  'Premium cabinet hinges with hydraulic mechanism for smooth, silent closing.' as description,
  'per piece' as unit,
  350 as base_price,
  300 as discount_price,
  true as is_discounted,
  'Hettich' as brand,
  'Premium' as quality_grade,
  true as is_available
FROM designers
WHERE email = 'priya.sharma@interiorcraft.com'
LIMIT 1;

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
  id as designer_id,
  'Countertops' as category,
  'Engineered Quartz' as name,
  'Man-made stone surface combining natural quartz with polymer resins for superior performance.' as description,
  'sq.ft' as unit,
  450 as base_price,
  null as discount_price,
  false as is_discounted,
  'Caesarstone' as brand,
  'Luxury' as quality_grade,
  true as is_available
FROM designers
WHERE email = 'priya.sharma@interiorcraft.com'
LIMIT 1;

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
  id as designer_id,
  'Lighting' as category,
  'LED Strip Lights' as name,
  'Flexible LED lighting strips for accent, task, and ambient lighting applications.' as description,
  'per meter' as unit,
  250 as base_price,
  200 as discount_price,
  true as is_discounted,
  'Philips' as brand,
  'Premium' as quality_grade,
  true as is_available
FROM designers
WHERE email = 'priya.sharma@interiorcraft.com'
LIMIT 1;