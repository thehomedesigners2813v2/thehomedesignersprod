/*
  # Create 2D Design Tool Tables

  1. New Tables
    - `design_projects` - Store 2D design projects
    - `design_rooms` - Store room data for designs
    - `design_furniture` - Store furniture items in designs
    - `design_walls` - Store wall data for designs

  2. Security
    - Enable RLS on all tables
    - Add policies for customers to manage their own designs
*/

-- Create design projects table
CREATE TABLE IF NOT EXISTS design_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_project_id uuid REFERENCES customers(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  grid_size integer DEFAULT 20,
  scale_factor numeric(5,2) DEFAULT 20.0, -- pixels per foot
  canvas_width integer DEFAULT 800,
  canvas_height integer DEFAULT 600,
  total_cost numeric(12,2) DEFAULT 0,
  is_public boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create design rooms table
CREATE TABLE IF NOT EXISTS design_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  design_project_id uuid REFERENCES design_projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  room_type text NOT NULL,
  points jsonb NOT NULL, -- Array of {x, y} coordinates
  color text DEFAULT '#E3F2FD',
  area numeric(8,2) DEFAULT 0, -- in square feet
  cost_per_sqft numeric(8,2) DEFAULT 1200,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create design furniture table
CREATE TABLE IF NOT EXISTS design_furniture (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  design_project_id uuid REFERENCES design_projects(id) ON DELETE CASCADE,
  furniture_type text NOT NULL,
  name text NOT NULL,
  x_position numeric(8,2) NOT NULL,
  y_position numeric(8,2) NOT NULL,
  width numeric(8,2) NOT NULL,
  height numeric(8,2) NOT NULL,
  rotation numeric(5,2) DEFAULT 0,
  color text DEFAULT '#8BC34A',
  price numeric(10,2) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create design walls table
CREATE TABLE IF NOT EXISTS design_walls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  design_project_id uuid REFERENCES design_projects(id) ON DELETE CASCADE,
  start_point jsonb NOT NULL, -- {x, y} coordinates
  end_point jsonb NOT NULL, -- {x, y} coordinates
  thickness numeric(5,2) DEFAULT 6,
  color text DEFAULT '#666666',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE design_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE design_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE design_furniture ENABLE ROW LEVEL SECURITY;
ALTER TABLE design_walls ENABLE ROW LEVEL SECURITY;

-- Policies for design_projects
DROP POLICY IF EXISTS "Users can manage own design projects" ON design_projects;
CREATE POLICY "Users can manage own design projects"
  ON design_projects
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Public can read public design projects" ON design_projects;
CREATE POLICY "Public can read public design projects"
  ON design_projects
  FOR SELECT
  TO anon, authenticated
  USING (is_public = true);

-- Policies for design_rooms
DROP POLICY IF EXISTS "Users can manage rooms in own design projects" ON design_rooms;
CREATE POLICY "Users can manage rooms in own design projects"
  ON design_rooms
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM design_projects 
      WHERE id = design_rooms.design_project_id 
      AND user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM design_projects 
      WHERE id = design_rooms.design_project_id 
      AND user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Public can read rooms in public design projects" ON design_rooms;
CREATE POLICY "Public can read rooms in public design projects"
  ON design_rooms
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM design_projects 
      WHERE id = design_rooms.design_project_id 
      AND is_public = true
    )
  );

-- Policies for design_furniture
DROP POLICY IF EXISTS "Users can manage furniture in own design projects" ON design_furniture;
CREATE POLICY "Users can manage furniture in own design projects"
  ON design_furniture
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM design_projects 
      WHERE id = design_furniture.design_project_id 
      AND user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM design_projects 
      WHERE id = design_furniture.design_project_id 
      AND user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Public can read furniture in public design projects" ON design_furniture;
CREATE POLICY "Public can read furniture in public design projects"
  ON design_furniture
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM design_projects 
      WHERE id = design_furniture.design_project_id 
      AND is_public = true
    )
  );

-- Policies for design_walls
DROP POLICY IF EXISTS "Users can manage walls in own design projects" ON design_walls;
CREATE POLICY "Users can manage walls in own design projects"
  ON design_walls
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM design_projects 
      WHERE id = design_walls.design_project_id 
      AND user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM design_projects 
      WHERE id = design_walls.design_project_id 
      AND user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Public can read walls in public design projects" ON design_walls;
CREATE POLICY "Public can read walls in public design projects"
  ON design_walls
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM design_projects 
      WHERE id = design_walls.design_project_id 
      AND is_public = true
    )
  );

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_design_projects_updated_at ON design_projects;
CREATE TRIGGER update_design_projects_updated_at
  BEFORE UPDATE ON design_projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_design_rooms_updated_at ON design_rooms;
CREATE TRIGGER update_design_rooms_updated_at
  BEFORE UPDATE ON design_rooms
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_design_furniture_updated_at ON design_furniture;
CREATE TRIGGER update_design_furniture_updated_at
  BEFORE UPDATE ON design_furniture
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_design_walls_updated_at ON design_walls;
CREATE TRIGGER update_design_walls_updated_at
  BEFORE UPDATE ON design_walls
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to update total cost when furniture or rooms change
CREATE OR REPLACE FUNCTION update_design_project_cost()
RETURNS TRIGGER AS $$
DECLARE
  project_id uuid;
  furniture_cost numeric := 0;
  room_cost numeric := 0;
  total numeric := 0;
BEGIN
  -- Get project ID from the trigger
  IF TG_TABLE_NAME = 'design_furniture' THEN
    project_id := COALESCE(NEW.design_project_id, OLD.design_project_id);
  ELSIF TG_TABLE_NAME = 'design_rooms' THEN
    project_id := COALESCE(NEW.design_project_id, OLD.design_project_id);
  END IF;

  -- Calculate furniture cost
  SELECT COALESCE(SUM(price), 0) INTO furniture_cost
  FROM design_furniture
  WHERE design_project_id = project_id;

  -- Calculate room cost
  SELECT COALESCE(SUM(area * cost_per_sqft), 0) INTO room_cost
  FROM design_rooms
  WHERE design_project_id = project_id;

  total := furniture_cost + room_cost;

  -- Update the design project
  UPDATE design_projects
  SET total_cost = total
  WHERE id = project_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Triggers to update cost
DROP TRIGGER IF EXISTS update_design_cost_on_furniture_change ON design_furniture;
CREATE TRIGGER update_design_cost_on_furniture_change
  AFTER INSERT OR UPDATE OR DELETE ON design_furniture
  FOR EACH ROW
  EXECUTE FUNCTION update_design_project_cost();

DROP TRIGGER IF EXISTS update_design_cost_on_room_change ON design_rooms;
CREATE TRIGGER update_design_cost_on_room_change
  AFTER INSERT OR UPDATE OR DELETE ON design_rooms
  FOR EACH ROW
  EXECUTE FUNCTION update_design_project_cost();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_design_projects_user_id ON design_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_design_projects_customer_project_id ON design_projects(customer_project_id);
CREATE INDEX IF NOT EXISTS idx_design_rooms_project_id ON design_rooms(design_project_id);
CREATE INDEX IF NOT EXISTS idx_design_furniture_project_id ON design_furniture(design_project_id);
CREATE INDEX IF NOT EXISTS idx_design_walls_project_id ON design_walls(design_project_id);