/*
  # Create Bill Versioning System

  1. New Tables
    - `bill_versions`
      - `id` (uuid, primary key)
      - `bill_id` (uuid, FK to project_bills.id) - the bill this version belongs to
      - `version_number` (integer) - auto-incremented per bill
      - `subtotal` (numeric) - snapshot of subtotal at this version
      - `discount_amount` (numeric) - snapshot of discount
      - `tax_rate` (numeric) - snapshot of tax rate
      - `tax_amount` (numeric) - snapshot of tax amount
      - `total_amount` (numeric) - snapshot of total
      - `status` (text) - bill status at time of version
      - `notes` (text) - bill notes at time of version
      - `items_snapshot` (jsonb) - full snapshot of all bill items at this version
      - `created_at` (timestamptz) - when this version was created

  2. Changes to `project_bills`
    - Add `current_version` (integer) column to track latest version

  3. Security
    - Enable RLS on `bill_versions`
    - Designers can view versions of their own bills
    - Customers can view versions of bills for their projects

  4. Trigger
    - Auto-create a new version snapshot whenever project_bills is updated
*/

-- Create bill_versions table
CREATE TABLE IF NOT EXISTS bill_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id uuid NOT NULL REFERENCES project_bills(id) ON DELETE CASCADE,
  version_number integer NOT NULL DEFAULT 1,
  subtotal numeric(12,2) DEFAULT 0,
  discount_amount numeric(12,2) DEFAULT 0,
  tax_rate numeric(5,2) DEFAULT 18.0,
  tax_amount numeric(12,2) DEFAULT 0,
  total_amount numeric(12,2) DEFAULT 0,
  status text DEFAULT 'draft',
  notes text DEFAULT '',
  items_snapshot jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Add current_version column to project_bills
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_bills' AND column_name = 'current_version'
  ) THEN
    ALTER TABLE project_bills ADD COLUMN current_version integer DEFAULT 0;
  END IF;
END $$;

-- Enable RLS
ALTER TABLE bill_versions ENABLE ROW LEVEL SECURITY;

-- RLS: Designers can view versions of their own bills
DROP POLICY IF EXISTS "Designers can view own bill versions" ON bill_versions;
CREATE POLICY "Designers can view own bill versions"
  ON bill_versions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM project_bills
      JOIN designers ON designers.id = project_bills.designer_id
      WHERE project_bills.id = bill_versions.bill_id
      AND designers.user_id = auth.uid()
    )
  );

-- RLS: Customers can view versions of bills for their projects
DROP POLICY IF EXISTS "Customers can view bill versions for own projects" ON bill_versions;
CREATE POLICY "Customers can view bill versions for own projects"
  ON bill_versions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM project_bills
      JOIN customers ON customers.id = project_bills.project_id
      WHERE project_bills.id = bill_versions.bill_id
      AND customers.user_id = auth.uid()
    )
  );

-- RLS: Allow system inserts (trigger runs as SECURITY DEFINER)
DROP POLICY IF EXISTS "System can insert bill versions" ON bill_versions;
CREATE POLICY "System can insert bill versions"
  ON bill_versions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_bills
      JOIN designers ON designers.id = project_bills.designer_id
      WHERE project_bills.id = bill_versions.bill_id
      AND designers.user_id = auth.uid()
    )
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bill_versions_bill_id ON bill_versions(bill_id);
CREATE INDEX IF NOT EXISTS idx_bill_versions_version_number ON bill_versions(bill_id, version_number DESC);

-- Function to create a version snapshot when bill is updated
CREATE OR REPLACE FUNCTION create_bill_version_snapshot()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next_version integer;
  v_items jsonb;
BEGIN
  -- Only create version if meaningful fields changed
  IF (
    OLD.subtotal IS DISTINCT FROM NEW.subtotal OR
    OLD.discount_amount IS DISTINCT FROM NEW.discount_amount OR
    OLD.tax_rate IS DISTINCT FROM NEW.tax_rate OR
    OLD.tax_amount IS DISTINCT FROM NEW.tax_amount OR
    OLD.total_amount IS DISTINCT FROM NEW.total_amount OR
    OLD.status IS DISTINCT FROM NEW.status OR
    OLD.notes IS DISTINCT FROM NEW.notes
  ) THEN
    -- Get next version number
    SELECT COALESCE(MAX(version_number), 0) + 1
    INTO v_next_version
    FROM bill_versions
    WHERE bill_id = NEW.id;

    -- Snapshot current items
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', bi.id,
        'item_type', bi.item_type,
        'name', bi.name,
        'description', bi.description,
        'number_of_units', bi.number_of_units,
        'quantity', bi.quantity,
        'unit', bi.unit,
        'unit_price', bi.unit_price,
        'discount_percent', bi.discount_percent,
        'amount', bi.amount,
        'length', bi.length,
        'breadth', bi.breadth
      )
    ), '[]'::jsonb)
    INTO v_items
    FROM bill_items bi
    WHERE bi.bill_id = NEW.id;

    -- Insert version record
    INSERT INTO bill_versions (
      bill_id, version_number, subtotal, discount_amount,
      tax_rate, tax_amount, total_amount, status, notes, items_snapshot
    ) VALUES (
      NEW.id, v_next_version, NEW.subtotal, NEW.discount_amount,
      NEW.tax_rate, NEW.tax_amount, NEW.total_amount, NEW.status, NEW.notes, v_items
    );

    -- Update current_version on the bill
    NEW.current_version := v_next_version;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_bill_version_on_update ON project_bills;
CREATE TRIGGER trigger_bill_version_on_update
  BEFORE UPDATE ON project_bills
  FOR EACH ROW
  EXECUTE FUNCTION create_bill_version_snapshot();
