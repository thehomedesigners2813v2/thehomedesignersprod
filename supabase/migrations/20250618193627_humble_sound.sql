/*
  # Add project sharing functionality

  1. New Tables
    - `project_shares`
      - `id` (uuid, primary key)
      - `project_id` (uuid, references customers)
      - `customer_id` (uuid, references auth.users)
      - `designer_email` (text)
      - `designer_phone` (text)
      - `message` (text)
      - `status` (text, default 'sent')
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `project_shares` table
    - Add policies for customers to manage their shares
    - Add policies for designers to view shares sent to them
*/

CREATE TABLE IF NOT EXISTS project_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES customers(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  designer_email text NOT NULL,
  designer_phone text,
  message text,
  status text DEFAULT 'sent',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE project_shares ENABLE ROW LEVEL SECURITY;

-- Policies for customers to manage their shares
DROP POLICY IF EXISTS "Customers can read own shares" ON project_shares;
CREATE POLICY "Customers can read own shares"
  ON project_shares
  FOR SELECT
  TO authenticated
  USING (auth.uid() = customer_id);

DROP POLICY IF EXISTS "Customers can insert own shares" ON project_shares;
CREATE POLICY "Customers can insert own shares"
  ON project_shares
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = customer_id);

DROP POLICY IF EXISTS "Customers can update own shares" ON project_shares;
CREATE POLICY "Customers can update own shares"
  ON project_shares
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = customer_id);

-- Policy for designers to view shares sent to them
DROP POLICY IF EXISTS "Designers can view shares sent to them" ON project_shares;
CREATE POLICY "Designers can view shares sent to them"
  ON project_shares
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM designers 
      WHERE designers.user_id = auth.uid() 
      AND designers.email = project_shares.designer_email
      AND designers.is_active = true
    )
  );

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_project_shares_updated_at ON project_shares;
CREATE TRIGGER update_project_shares_updated_at
  BEFORE UPDATE ON project_shares
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();