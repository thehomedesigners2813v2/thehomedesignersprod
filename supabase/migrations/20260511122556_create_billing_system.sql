/*
  # Create Billing System

  1. New Tables
    - `project_bills`
      - `id` (uuid, primary key)
      - `project_id` (uuid, FK to customers.id) - the project this bill belongs to
      - `quote_id` (uuid, FK to designer_quotes.id) - the accepted quote this bill was generated from
      - `designer_id` (uuid, FK to designers.id) - the designer who manages this bill
      - `bill_number` (text, unique) - auto-generated bill number
      - `subtotal` (numeric) - sum of all item amounts
      - `discount_amount` (numeric) - overall discount
      - `tax_rate` (numeric) - tax percentage
      - `tax_amount` (numeric) - calculated tax
      - `total_amount` (numeric) - final total
      - `status` (text) - 'draft', 'sent', 'paid', 'partially_paid'
      - `notes` (text) - designer notes
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `bill_items`
      - `id` (uuid, primary key)
      - `bill_id` (uuid, FK to project_bills.id)
      - `item_type` (text) - material, labor, service, component, other
      - `name` (text) - item name
      - `description` (text)
      - `number_of_units` (numeric) - count of items
      - `quantity` (numeric) - total area or units
      - `unit` (text) - sq.ft, hours, piece, etc.
      - `unit_price` (numeric) - price per unit
      - `discount_percent` (numeric) - item-level discount
      - `amount` (numeric) - calculated total for this item
      - `length` (numeric) - for area calculations
      - `breadth` (numeric) - for area calculations
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Designers can manage bills for their assigned projects
    - Customers can view bills for their own projects

  3. Trigger
    - Auto-copy quotation items to billing when a quote is accepted
*/

-- Create project_bills table
CREATE TABLE IF NOT EXISTS project_bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  quote_id uuid NOT NULL REFERENCES designer_quotes(id) ON DELETE CASCADE,
  designer_id uuid NOT NULL REFERENCES designers(id) ON DELETE CASCADE,
  bill_number text UNIQUE NOT NULL,
  subtotal numeric(12,2) DEFAULT 0,
  discount_amount numeric(12,2) DEFAULT 0,
  tax_rate numeric(5,2) DEFAULT 18.0,
  tax_amount numeric(12,2) DEFAULT 0,
  total_amount numeric(12,2) DEFAULT 0,
  status text DEFAULT 'draft',
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create bill_items table
CREATE TABLE IF NOT EXISTS bill_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id uuid NOT NULL REFERENCES project_bills(id) ON DELETE CASCADE,
  item_type text DEFAULT 'material',
  name text NOT NULL,
  description text DEFAULT '',
  number_of_units numeric(10,2) DEFAULT 1,
  quantity numeric(10,2) DEFAULT 0,
  unit text DEFAULT 'sq.ft',
  unit_price numeric(10,2) DEFAULT 0,
  discount_percent numeric(5,2) DEFAULT 0,
  amount numeric(12,2) DEFAULT 0,
  length numeric(10,2),
  breadth numeric(10,2),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE project_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for project_bills

-- Designers can view bills they created
DROP POLICY IF EXISTS "Designers can view own bills" ON project_bills;
CREATE POLICY "Designers can view own bills"
  ON project_bills FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM designers
      WHERE designers.id = project_bills.designer_id
      AND designers.user_id = auth.uid()
    )
  );

-- Designers can insert bills for their assigned projects
DROP POLICY IF EXISTS "Designers can create bills" ON project_bills;
CREATE POLICY "Designers can create bills"
  ON project_bills FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM designers
      WHERE designers.id = project_bills.designer_id
      AND designers.user_id = auth.uid()
    )
  );

-- Designers can update their own bills
DROP POLICY IF EXISTS "Designers can update own bills" ON project_bills;
CREATE POLICY "Designers can update own bills"
  ON project_bills FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM designers
      WHERE designers.id = project_bills.designer_id
      AND designers.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM designers
      WHERE designers.id = project_bills.designer_id
      AND designers.user_id = auth.uid()
    )
  );

-- Designers can delete their own bills
DROP POLICY IF EXISTS "Designers can delete own bills" ON project_bills;
CREATE POLICY "Designers can delete own bills"
  ON project_bills FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM designers
      WHERE designers.id = project_bills.designer_id
      AND designers.user_id = auth.uid()
    )
  );

-- Customers can view bills for their projects
DROP POLICY IF EXISTS "Customers can view bills for own projects" ON project_bills;
CREATE POLICY "Customers can view bills for own projects"
  ON project_bills FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.id = project_bills.project_id
      AND customers.user_id = auth.uid()
    )
  );

-- RLS Policies for bill_items

-- Designers can view items for their bills
DROP POLICY IF EXISTS "Designers can view own bill items" ON bill_items;
CREATE POLICY "Designers can view own bill items"
  ON bill_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM project_bills
      JOIN designers ON designers.id = project_bills.designer_id
      WHERE project_bills.id = bill_items.bill_id
      AND designers.user_id = auth.uid()
    )
  );

-- Designers can insert items into their bills
DROP POLICY IF EXISTS "Designers can add bill items" ON bill_items;
CREATE POLICY "Designers can add bill items"
  ON bill_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_bills
      JOIN designers ON designers.id = project_bills.designer_id
      WHERE project_bills.id = bill_items.bill_id
      AND designers.user_id = auth.uid()
    )
  );

-- Designers can update items in their bills
DROP POLICY IF EXISTS "Designers can update bill items" ON bill_items;
CREATE POLICY "Designers can update bill items"
  ON bill_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM project_bills
      JOIN designers ON designers.id = project_bills.designer_id
      WHERE project_bills.id = bill_items.bill_id
      AND designers.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_bills
      JOIN designers ON designers.id = project_bills.designer_id
      WHERE project_bills.id = bill_items.bill_id
      AND designers.user_id = auth.uid()
    )
  );

-- Designers can delete items from their bills
DROP POLICY IF EXISTS "Designers can delete bill items" ON bill_items;
CREATE POLICY "Designers can delete bill items"
  ON bill_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM project_bills
      JOIN designers ON designers.id = project_bills.designer_id
      WHERE project_bills.id = bill_items.bill_id
      AND designers.user_id = auth.uid()
    )
  );

-- Customers can view items for bills on their projects
DROP POLICY IF EXISTS "Customers can view bill items for own projects" ON bill_items;
CREATE POLICY "Customers can view bill items for own projects"
  ON bill_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM project_bills
      JOIN customers ON customers.id = project_bills.project_id
      WHERE project_bills.id = bill_items.bill_id
      AND customers.user_id = auth.uid()
    )
  );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_project_bills_project_id ON project_bills(project_id);
CREATE INDEX IF NOT EXISTS idx_project_bills_designer_id ON project_bills(designer_id);
CREATE INDEX IF NOT EXISTS idx_project_bills_quote_id ON project_bills(quote_id);
CREATE INDEX IF NOT EXISTS idx_project_bills_status ON project_bills(status);
CREATE INDEX IF NOT EXISTS idx_bill_items_bill_id ON bill_items(bill_id);

-- Function to auto-generate bill from accepted quote
CREATE OR REPLACE FUNCTION create_bill_from_accepted_quote()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bill_id uuid;
  v_bill_number text;
  v_subtotal numeric(12,2);
  v_tax_amount numeric(12,2);
  v_total_amount numeric(12,2);
BEGIN
  -- Only trigger when quote becomes accepted
  IF NEW.customer_accepted = true AND (OLD.customer_accepted = false OR OLD.customer_accepted IS NULL) THEN
    -- Check if a bill already exists for this quote
    IF EXISTS (SELECT 1 FROM project_bills WHERE quote_id = NEW.id) THEN
      RETURN NEW;
    END IF;

    -- Generate bill number
    v_bill_number := 'BILL-' || to_char(now(), 'YYYYMMDD') || '-' || substr(gen_random_uuid()::text, 1, 6);

    -- Create the bill record
    INSERT INTO project_bills (
      id, project_id, quote_id, designer_id, bill_number,
      subtotal, discount_amount, tax_rate, tax_amount, total_amount,
      status, notes
    ) VALUES (
      gen_random_uuid(), NEW.project_id, NEW.id, NEW.designer_id, v_bill_number,
      NEW.subtotal, NEW.discount_amount, NEW.tax_rate, NEW.tax_amount, NEW.total_amount,
      'draft', ''
    ) RETURNING id INTO v_bill_id;

    -- Copy all quote items to bill items
    INSERT INTO bill_items (
      bill_id, item_type, name, description, number_of_units,
      quantity, unit, unit_price, discount_percent, amount,
      length, breadth
    )
    SELECT
      v_bill_id, item_type, name, description, number_of_units,
      quantity, unit, unit_price, discount_percent, amount,
      length, breadth
    FROM quote_items
    WHERE quote_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger on designer_quotes for auto-billing
DROP TRIGGER IF EXISTS trigger_create_bill_on_quote_acceptance ON designer_quotes;
CREATE TRIGGER trigger_create_bill_on_quote_acceptance
  AFTER UPDATE ON designer_quotes
  FOR EACH ROW
  EXECUTE FUNCTION create_bill_from_accepted_quote();
