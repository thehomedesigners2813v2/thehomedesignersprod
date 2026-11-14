/*
  # Create customers table for project registrations

  1. New Tables
    - `customers`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `name` (text)
      - `email` (text)
      - `phone` (text)
      - `location` (text)
      - `project_name` (text)
      - `property_type` (text)
      - `project_area` (text)
      - `budget_range` (text)
      - `timeline` (text)
      - `requirements` (text)
      - `preferred_designer` (text)
      - `layout_image_url` (text)
      - `inspiration_links` (text array)
      - `room_types` (text array)
      - `special_requirements` (text)
      - `status` (text, default 'pending')
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `customers` table
    - Add policies for customers to manage their own projects
    - Add policies for designers to view customer projects (for matching)
*/

CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  location text NOT NULL,
  project_name text NOT NULL,
  property_type text NOT NULL,
  project_area text,
  budget_range text NOT NULL,
  timeline text NOT NULL,
  requirements text NOT NULL,
  preferred_designer text,
  layout_image_url text,
  inspiration_links text[] DEFAULT '{}',
  room_types text[] DEFAULT '{}',
  special_requirements text,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Policies for customers to manage their own projects
DROP POLICY IF EXISTS "Customers can read own projects" ON customers;
CREATE POLICY "Customers can read own projects"
  ON customers
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Customers can update own projects" ON customers;
CREATE POLICY "Customers can update own projects"
  ON customers
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Customers can insert own projects" ON customers;
CREATE POLICY "Customers can insert own projects"
  ON customers
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy for designers to view customer projects (for matching purposes)
DROP POLICY IF EXISTS "Designers can view customer projects" ON customers;
CREATE POLICY "Designers can view customer projects"
  ON customers
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM designers 
      WHERE designers.user_id = auth.uid() 
      AND designers.is_active = true
    )
  );

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_customers_updated_at ON customers;
CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();