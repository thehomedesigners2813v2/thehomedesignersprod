-- Restore missing RLS policies on designer_quotes so designers can
-- create, update, delete, and view their own quotes.
-- The original policies were lost during later migrations, leaving only
-- an admin SELECT policy, which caused 403 Forbidden when designers
-- tried to save/send quotations.

-- SELECT: designers can view their own quotes
DROP POLICY IF EXISTS "Designers can view their own quotes" ON designer_quotes;
CREATE POLICY "Designers can view their own quotes"
  ON designer_quotes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM designers
      WHERE designers.id = designer_quotes.designer_id
      AND designers.user_id = auth.uid()
    )
  );

-- SELECT: customers can view quotes for their projects
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

-- INSERT: designers can create quotes for their own designer account
DROP POLICY IF EXISTS "Designers can insert their own quotes" ON designer_quotes;
CREATE POLICY "Designers can insert their own quotes"
  ON designer_quotes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM designers
      WHERE designers.id = designer_quotes.designer_id
      AND designers.user_id = auth.uid()
    )
  );

-- UPDATE: designers can update their own quotes
DROP POLICY IF EXISTS "Designers can update their own quotes" ON designer_quotes;
CREATE POLICY "Designers can update their own quotes"
  ON designer_quotes
  FOR UPDATE
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

-- DELETE: designers can delete their own quotes
DROP POLICY IF EXISTS "Designers can delete their own quotes" ON designer_quotes;
CREATE POLICY "Designers can delete their own quotes"
  ON designer_quotes
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM designers
      WHERE designers.id = designer_quotes.designer_id
      AND designers.user_id = auth.uid()
    )
  );

-- Restore missing UPDATE and DELETE policies on quote_items for designers
DROP POLICY IF EXISTS "Designers can update their own quote items" ON quote_items;
CREATE POLICY "Designers can update their own quote items"
  ON quote_items
  FOR UPDATE
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

DROP POLICY IF EXISTS "Designers can delete their own quote items" ON quote_items;
CREATE POLICY "Designers can delete their own quote items"
  ON quote_items
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM designer_quotes
      JOIN designers ON designers.id = designer_quotes.designer_id
      WHERE designer_quotes.id = quote_items.quote_id
      AND designers.user_id = auth.uid()
    )
  );
