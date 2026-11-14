/*
  # Add Material Pricing and Quote Management for Designers

  1. New Tables
    - `designer_material_prices` - Store material pricing for designers
    - `designer_quotes` - Store quotes created by designers
    - `quote_items` - Store individual items in quotes

  2. Security
    - Enable RLS on all tables
    - Add policies for designers to manage their own materials and quotes
    - Add policies for customers to view quotes for their projects
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

-- Create designer quotes table
CREATE TABLE IF NOT EXISTS designer_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  designer_id uuid REFERENCES designers(id) ON DELETE CASCADE,
  project_id uuid REFERENCES customers(id) ON DELETE CASCADE,
  quote_number text NOT NULL,
  title text NOT NULL,
  description text,
  subtotal numeric(12,2) NOT NULL,
  discount_amount numeric(12,2) DEFAULT 0,
  tax_rate numeric(5,2) DEFAULT 18.0,
  tax_amount numeric(12,2) DEFAULT 0,
  total_amount numeric(12,2) NOT NULL,
  status text DEFAULT 'draft', -- 'draft', 'sent', 'accepted', 'rejected', 'expired'
  valid_until date,
  terms_and_conditions text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create quote items table
CREATE TABLE IF NOT EXISTS quote_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid REFERENCES designer_quotes(id) ON DELETE CASCADE,
  material_id uuid REFERENCES designer_material_prices(id) ON DELETE SET NULL,
  item_type text NOT NULL, -- 'material', 'labor', 'service', 'other'
  name text NOT NULL,
  description text,
  quantity numeric(10,2) NOT NULL,
  unit text NOT NULL,
  unit_price numeric(10,2) NOT NULL,
  discount_percent numeric(5,2) DEFAULT 0,
  amount numeric(12,2) NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE designer_material_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE designer_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_items ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Designers can manage their own material prices" ON designer_material_prices;
DROP POLICY IF EXISTS "Public can read available material prices" ON designer_material_prices;
DROP POLICY IF EXISTS "Designers can manage their own quotes" ON designer_quotes;
DROP POLICY IF EXISTS "Customers can view quotes for their projects" ON designer_quotes;
DROP POLICY IF EXISTS "Designers can manage their own quote items" ON quote_items;
DROP POLICY IF EXISTS "Customers can view quote items for their projects" ON quote_items;

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

-- Policies for designer_quotes
DROP POLICY IF EXISTS "Designers can manage their own quotes" ON designer_quotes;
CREATE POLICY "Designers can manage their own quotes"
  ON designer_quotes
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM designers 
      WHERE designers.id = designer_quotes.designer_id 
      AND designers.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM designers 
      WHERE designers.id = designer_quotes.designer_id 
      AND designers.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Customers can view quotes for their projects" ON designer_quotes;
CREATE POLICY "Customers can view quotes for their projects"
  ON designer_quotes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM customers 
      WHERE customers.id = designer_quotes.project_id 
      AND customers.user_id = auth.uid()
    )
  );

-- Policies for quote_items
DROP POLICY IF EXISTS "Designers can manage their own quote items" ON quote_items;
CREATE POLICY "Designers can manage their own quote items"
  ON quote_items
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM designer_quotes
      JOIN designers ON designers.id = designer_quotes.designer_id
      WHERE designer_quotes.id = quote_items.quote_id
      AND designers.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM designer_quotes
      JOIN designers ON designers.id = designer_quotes.designer_id
      WHERE designer_quotes.id = quote_items.quote_id
      AND designers.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Customers can view quote items for their projects" ON quote_items;
CREATE POLICY "Customers can view quote items for their projects"
  ON quote_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM designer_quotes
      JOIN customers ON customers.id = designer_quotes.project_id
      WHERE designer_quotes.id = quote_items.quote_id
      AND customers.user_id = auth.uid()
    )
  );

-- Check if trigger exists before creating it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_designer_material_prices_updated_at'
  ) THEN
    DROP TRIGGER IF EXISTS update_designer_material_prices_updated_at ON designer_material_prices;
CREATE TRIGGER update_designer_material_prices_updated_at
      BEFORE UPDATE ON designer_material_prices
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_designer_quotes_updated_at'
  ) THEN
    DROP TRIGGER IF EXISTS update_designer_quotes_updated_at ON designer_quotes;
CREATE TRIGGER update_designer_quotes_updated_at
      BEFORE UPDATE ON designer_quotes
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_designer_material_prices_designer_id 
ON designer_material_prices(designer_id);

CREATE INDEX IF NOT EXISTS idx_designer_material_prices_category 
ON designer_material_prices(category);

CREATE INDEX IF NOT EXISTS idx_designer_material_prices_name 
ON designer_material_prices(name);

CREATE INDEX IF NOT EXISTS idx_designer_quotes_designer_id 
ON designer_quotes(designer_id);

CREATE INDEX IF NOT EXISTS idx_designer_quotes_project_id 
ON designer_quotes(project_id);

CREATE INDEX IF NOT EXISTS idx_designer_quotes_status 
ON designer_quotes(status);

CREATE INDEX IF NOT EXISTS idx_quote_items_quote_id 
ON quote_items(quote_id);

CREATE INDEX IF NOT EXISTS idx_quote_items_material_id 
ON quote_items(material_id);

-- Insert sample data for testing (only if it doesn't exist already)
DO $$
DECLARE
  designer_id_val uuid;
  material_exists boolean;
BEGIN
  -- Get the designer ID
  SELECT id INTO designer_id_val FROM designers WHERE email = 'priya.sharma@interiorcraft.com' LIMIT 1;
  
  IF designer_id_val IS NOT NULL THEN
    -- Check if material already exists
    SELECT EXISTS (
      SELECT 1 FROM designer_material_prices 
      WHERE designer_id = designer_id_val AND name = 'Marine Plywood'
    ) INTO material_exists;
    
    -- Insert only if it doesn't exist
    IF NOT material_exists THEN
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
      ) VALUES (
        designer_id_val,
        'Plywood & Boards',
        'Marine Plywood',
        'High-quality waterproof plywood made with phenolic resin, ideal for moisture-prone areas.',
        'sq.ft',
        120,
        100,
        true,
        'Century Ply',
        'Premium',
        true
      );
    END IF;
    
    -- Check if material already exists
    SELECT EXISTS (
      SELECT 1 FROM designer_material_prices 
      WHERE designer_id = designer_id_val AND name = 'High Pressure Laminate (HPL)'
    ) INTO material_exists;
    
    -- Insert only if it doesn't exist
    IF NOT material_exists THEN
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
      ) VALUES (
        designer_id_val,
        'Laminates & Veneers',
        'High Pressure Laminate (HPL)',
        'Durable decorative surface material made from multiple layers of kraft paper and resin.',
        'sq.ft',
        85,
        null,
        false,
        'Merino',
        'Standard',
        true
      );
    END IF;
    
    -- Check if material already exists
    SELECT EXISTS (
      SELECT 1 FROM designer_material_prices 
      WHERE designer_id = designer_id_val AND name = 'Soft Close Hinges'
    ) INTO material_exists;
    
    -- Insert only if it doesn't exist
    IF NOT material_exists THEN
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
      ) VALUES (
        designer_id_val,
        'Hardware',
        'Soft Close Hinges',
        'Premium cabinet hinges with hydraulic mechanism for smooth, silent closing.',
        'per piece',
        350,
        300,
        true,
        'Hettich',
        'Premium',
        true
      );
    END IF;
  END IF;
END $$;